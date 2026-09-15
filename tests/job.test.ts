import request from 'supertest';
import express from 'express';
import jobRoutes from '../src/routes/jobRoutes';

// Mock Prisma ORM to prevent actual database calls during unit testing
jest.mock('@prisma/client', () => {
  const mPrismaClient = {
    job: {
      findMany: jest.fn().mockResolvedValue([
        { id: '1', status: 'draft' }
      ]),
      create: jest.fn().mockResolvedValue(
        { id: '2', status: 'draft' }
      )
    },
  };
  return { PrismaClient: jest.fn(() => mPrismaClient) };
});

const app = express();
app.use(express.json());
app.use('/api/v1/jobs', jobRoutes);

describe('Jobs API Controller', () => {
  it('GET /api/v1/jobs - should return list of jobs', async () => {
    const res = await request(app).get('/api/v1/jobs');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBeTruthy();
    expect(res.body[0].status).toBe('draft');
  });

  it('POST /api/v1/jobs - should create a new job via Booking Form', async () => {
    const res = await request(app).post('/api/v1/jobs').send({
      tenantId: 'uuid',
      customerId: 'uuid',
      propertyId: 'uuid'
    });
    expect(res.statusCode).toEqual(201);
    expect(res.body.id).toBe('2');
  });
});
