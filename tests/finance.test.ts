import request from 'supertest';
import express from 'express';
import financeRoutes from '../src/routes/financeRoutes';

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

const app = express();
app.use(express.json());
// Mock auth middleware for tests
app.use((req: any, res, next) => {
  req.user = { id: 'admin', role: 'SUPER_ADMIN', tenantId: 'mock-tenant-id' };
  next();
});
app.use('/api/v1/finance', financeRoutes);

describe('Finance API Controller', () => {
  it('PATCH /api/v1/finance/quotes/:id/accept - should accept quote and create job', async () => {
    const res = await request(app).patch('/api/v1/finance/quotes/mock-quote-id/accept');
    expect(res.statusCode).toEqual(200);
    expect(res.body.quote.status).toBe('accepted');
    expect(res.body.job.id).toBe('mock-job-id');
  });
});
