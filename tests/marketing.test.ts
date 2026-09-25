import request from 'supertest';
import express from 'express';
import marketingRoutes from '../src/routes/marketingRoutes';

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mPrismaClient = {
    campaign: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'camp-1', name: 'Spring Promo', status: 'active', budget: 500 }
      ]),
      create: jest.fn().mockResolvedValue({
        id: 'camp-2', name: 'Fall Promo', status: 'draft', budget: 1000
      })
    }
  };
  return { PrismaClient: jest.fn(() => mPrismaClient) };
});

const app = express();
app.use(express.json());

// Mock auth middleware
app.use((req: any, res, next) => {
  req.user = { id: 'admin', role: 'SUPER_ADMIN', tenantId: 'mock-tenant-id' };
  next();
});
app.use('/api/v1/marketing', marketingRoutes);

describe('Marketing API Controller', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/v1/marketing/campaigns - should return list of campaigns', async () => {
    const res = await request(app).get('/api/v1/marketing/campaigns');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe('Spring Promo');
  });

  it('POST /api/v1/marketing/campaigns - should create a new campaign', async () => {
    const payload = {
      name: 'Fall Promo',
      budget: 1000,
      startDate: '2026-10-01',
      endDate: '2026-10-31'
    };
    const res = await request(app).post('/api/v1/marketing/campaigns').send(payload);
    expect(res.statusCode).toEqual(201);
    expect(res.body.name).toBe('Fall Promo');
    expect(res.body.budget).toBe(1000);
  });
});
