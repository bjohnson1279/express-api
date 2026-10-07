jest.mock('@prisma/client', () => {
  const mPrismaClient = {
    job: {
      create: jest.fn(),
    },
  };
  return { PrismaClient: jest.fn(() => mPrismaClient) };
});

import request from 'supertest';
import fastify from 'fastify';
import bookingRoutes from '../src/domains/dispatch/bookingRoutes';
import { PrismaClient } from '@prisma/client';

const prisma = new (PrismaClient as any)();

let fastifyApp: ReturnType<typeof fastify>;
let app: any;

beforeAll(async () => {
  fastifyApp = fastify();
  fastifyApp.register(bookingRoutes, { prefix: '/api/v1/booking' });
  await fastifyApp.ready();
  app = fastifyApp.server;
});

afterAll(async () => {
  await fastifyApp.close();
});

describe('Booking API Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /api/v1/booking/slots', () => {
    it('should return available slots when date is provided', async () => {
      const res = await request(app).get('/api/v1/booking/slots?date=2026-10-15');

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toEqual([
        { time: '08:00', available: true },
        { time: '10:00', available: true },
        { time: '12:00', available: true },
        { time: '14:00', available: true },
      ]);
    });

    it('should return 400 when date query parameter is missing', async () => {
      const res = await request(app).get('/api/v1/booking/slots');

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: 'Date is required' });
    });
  });

  describe('POST /api/v1/booking', () => {
    it('should successfully create a new booking/job', async () => {
      const bookingData = {
        tenantId: 'tenant-123',
        customerId: 'cust-456',
        propertyId: 'prop-789',
        date: '2026-10-15',
        time: '10:00',
      };

      const createdJob = {
        id: 'job-1',
        tenantId: bookingData.tenantId,
        customerId: bookingData.customerId,
        propertyId: bookingData.propertyId,
        status: 'scheduled',
        scheduledStart: '2026-10-15T10:00:00.000Z',
        scheduledEnd: '2026-10-15T12:00:00.000Z',
      };

      prisma.job.create.mockResolvedValue(createdJob);

      const res = await request(app).post('/api/v1/booking').send(bookingData);

      expect(res.statusCode).toBe(201);
      expect(res.body).toEqual(createdJob);
      expect(prisma.job.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-123',
          customerId: 'cust-456',
          propertyId: 'prop-789',
          status: 'scheduled',
          scheduledStart: new Date('2026-10-15T10:00:00Z'),
          scheduledEnd: new Date('2026-10-15T12:00:00Z'),
        },
      });
    });

    it('should return 400 when any required field is missing', async () => {
      const missingFieldsPayloads = [
        { customerId: 'c1', propertyId: 'p1', date: '2026-10-15', time: '10:00' }, // missing tenantId
        { tenantId: 't1', propertyId: 'p1', date: '2026-10-15', time: '10:00' }, // missing customerId
        { tenantId: 't1', customerId: 'c1', date: '2026-10-15', time: '10:00' }, // missing propertyId
        { tenantId: 't1', customerId: 'c1', propertyId: 'p1', time: '10:00' }, // missing date
        { tenantId: 't1', customerId: 'c1', propertyId: 'p1', date: '2026-10-15' }, // missing time
      ];

      for (const payload of missingFieldsPayloads) {
        const res = await request(app).post('/api/v1/booking').send(payload);
        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({ error: 'Missing required booking fields' });
      }

      expect(prisma.job.create).not.toHaveBeenCalled();
    });

    it('should return 500 when database creation fails', async () => {
      prisma.job.create.mockRejectedValue(new Error('Database write error'));

      const res = await request(app).post('/api/v1/booking').send({
        tenantId: 'tenant-123',
        customerId: 'cust-456',
        propertyId: 'prop-789',
        date: '2026-10-15',
        time: '10:00',
      });

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });
  });
});
