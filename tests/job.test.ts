import request from 'supertest';
import fastify from 'fastify';
import { createHmac } from 'node:crypto';
import jobRoutes from '../src/domains/dispatch/jobRoutes';

const mockQueryRaw = jest.fn();

// Mock Prisma ORM to prevent actual database calls during unit testing
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn(() => ({
      $queryRaw: (...args: any[]) => mockQueryRaw(...args),
    })),
  };
});

function authHeader() {
  const encode = (v: any) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const s =
    encode({ alg: 'HS256' }) +
    '.' +
    encode({
      id: '11111111-1111-4111-8111-111111111111',
      tenantId: '22222222-2222-4222-8222-222222222222',
      role: 'MANAGER',
      exp: Date.now() / 1000 + 600,
    });
  return 'Bearer ' + s + '.' + createHmac('sha256', 'job-test-key').update(s).digest('base64url');
}

let fastifyApp: ReturnType<typeof fastify>;
let app: any;

beforeAll(async () => {
  process.env.JWT_SECRET = 'job-test-key';
  fastifyApp = fastify();
  fastifyApp.register(jobRoutes, { prefix: '/api/v1/jobs' });
  await fastifyApp.ready();
  app = fastifyApp.server;
});

afterAll(async () => {
  await fastifyApp.close();
});

describe('Jobs API Controller', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'job-test-key';
    mockQueryRaw.mockReset();
  });

  it('GET /api/v1/jobs - should return list of jobs', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { result: { items: [{ id: '1', status: 'draft' }], has_more: false, next_cursor: '', limit: 50 } },
    ]);
    const res = await request(app).get('/api/v1/jobs').set('Authorization', authHeader());
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBeTruthy();
    expect(res.body[0].status).toBe('draft');
  });

  it('POST /api/v1/jobs - should create a new job via Booking Form', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ result: { id: '2', status: 'draft' } }]);
    const res = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', authHeader())
      .send({
        tenantId: '22222222-2222-4222-8222-222222222222',
        customerId: '33333333-3333-4333-8333-333333333333',
        propertyId: '44444444-4444-4444-8444-444444444444',
      });
    expect(res.statusCode).toEqual(201);
    expect(res.body.id).toBe('2');
  });
});
