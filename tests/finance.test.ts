import request from 'supertest';
import fastify from 'fastify';
import financeRoutes from '../src/domains/billing/financeRoutes';

jest.mock('@prisma/client', () => {
  const mPrismaClient = {
    quote: {
      update: jest.fn().mockResolvedValue({
        id: 'mock-quote-id',
        status: 'accepted',
        customerId: 'mock-customer-id',
        propertyId: 'mock-property-id',
        customer: { tenantId: 'mock-tenant-id' }
      })
    },
    job: {
      create: jest.fn().mockResolvedValue({
        id: 'mock-job-id',
        status: 'draft'
      })
    }
  };
  return { PrismaClient: jest.fn(() => mPrismaClient) };
});

let fastifyApp: ReturnType<typeof fastify>;
let app: any;

beforeAll(async () => {
  fastifyApp = fastify();
  
  // Mock auth middleware for tests
  fastifyApp.addHook('onRequest', async (req: any, reply: any) => {
    req.user = { id: 'admin', role: 'SUPER_ADMIN', tenantId: 'mock-tenant-id' };
  });
  
  fastifyApp.register(financeRoutes, { prefix: '/api/v1/finance' });
  await fastifyApp.ready();
  app = fastifyApp.server;
});

afterAll(async () => {
  await fastifyApp.close();
});

describe('Finance API Controller', () => {
  it('PATCH /api/v1/finance/quotes/:id/accept - should accept quote and create job', async () => {
    const res = await request(app).patch('/api/v1/finance/quotes/mock-quote-id/accept');
    expect(res.statusCode).toEqual(200);
    expect(res.body.quote.status).toBe('accepted');
    expect(res.body.job.id).toBe('mock-job-id');
  });
});
