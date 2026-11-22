import { EventEmitter } from 'events';

const mPrismaClient: any = {
  propertyPhoto: { create: jest.fn(), findMany: jest.fn() },
  chemicalApplicationLog: { findMany: jest.fn() },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mPrismaClient),
}));

const mockSaveMultipartUpload = jest.fn();
jest.mock('../src/shared/multipartUpload', () => ({
  saveMultipartUpload: (...args: any[]) => mockSaveMultipartUpload(...args),
}));

const mockSubscribe = jest.fn();
const mockUnsubscribe = jest.fn();
jest.mock('../src/domains/comms/eventBus', () => ({
  eventBus: {
    subscribe: (...args: any[]) => mockSubscribe(...args),
    unsubscribe: (...args: any[]) => mockUnsubscribe(...args),
  },
}));

jest.mock('../src/shared/auth/session', () => ({
  authenticate: jest.fn().mockResolvedValue({ id: 'u-1', tenantId: 't-1' }),
}));

jest.mock('ioredis', () => jest.fn().mockImplementation(() => ({ status: 'mock' })));

import Fastify from 'fastify';
import propertyRoutes from '../src/domains/crm/propertyRoutes';
import eventRoutes from '../src/domains/comms/eventRoutes';
import { apiLimiter } from '../src/shared/middleware/rateLimiter';
import { getEpaComplianceReport } from '../src/domains/dispatch/inventoryController';

describe('PropertyRoutes, EventRoutes, RateLimiter, and EPA Compliance Report (Express)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('propertyRoutes handles POST and GET /:id/photos', async () => {
    const app = Fastify();
    await app.register(propertyRoutes, { prefix: '/properties' });

    mockSaveMultipartUpload.mockResolvedValueOnce({
      filename: 'fence.jpg',
      fields: { jobId: 'j-1', caption: 'North fence', tags: '["exterior"]' },
    });
    mPrismaClient.propertyPhoto.create.mockResolvedValueOnce({
      id: 'ph-1',
      propertyId: 'p-1',
      url: '/uploads/photos/fence.jpg',
    });

    const rPost = await app.inject({ method: 'POST', url: '/properties/p-1/photos' });
    expect(rPost.statusCode).toBe(201);
    expect(rPost.json().url).toBe('/uploads/photos/fence.jpg');

    mPrismaClient.propertyPhoto.findMany.mockResolvedValueOnce([{ id: 'ph-1', url: '/uploads/photos/fence.jpg' }]);
    const rGet = await app.inject({ method: 'GET', url: '/properties/p-1/photos' });
    expect(rGet.statusCode).toBe(200);
    expect(rGet.json()).toHaveLength(1);

    await app.close();
  });

  it('eventRoutes hijacks reply, writes SSE header, subscribes, and cleans up on close', async () => {
    let registeredHandler: any;
    const fakeFastify: any = {
      get: (_path: string, handler: any) => {
        registeredHandler = handler;
      },
    };
    await eventRoutes(fakeFastify, {});
    expect(registeredHandler).toBeDefined();

    const raw = new EventEmitter() as any;
    raw.writeHead = jest.fn();
    raw.write = jest.fn();
    raw.end = jest.fn();

    const reply: any = { hijack: jest.fn(), raw };
    registeredHandler({ user: { tenantId: 't-1' }, headers: { authorization: 'Bearer tok' } }, reply);

    expect(reply.hijack).toHaveBeenCalled();
    expect(raw.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({ 'Content-Type': 'text/event-stream' }));
    expect(mockSubscribe).toHaveBeenCalledWith(reply, 't-1');

    raw.emit('close');
    expect(mockUnsubscribe).toHaveBeenCalledWith(reply);
  });

  it('apiLimiter registers fastifyRateLimit with tenant-aware keyGenerator and errorResponseBuilder', async () => {
    let capturedOpts: any;
    const fakeFastify: any = {
      register: jest.fn((_plugin: any, opts: any) => {
        capturedOpts = opts;
        return Promise.resolve();
      }),
    };
    await apiLimiter(fakeFastify, {});
    expect(capturedOpts.keyGenerator({ user: { tenantId: 't-1', id: 'u-1' }, ip: '1.2.3.4' })).toBe('t-1:u-1');
    expect(capturedOpts.keyGenerator({ ip: '1.2.3.4' })).toBe('1.2.3.4');
    expect(capturedOpts.keyGenerator({})).toBe('unknown-ip');
    expect(capturedOpts.errorResponseBuilder({}, {})).toEqual(
      expect.objectContaining({ error: 'Too Many Requests' })
    );
  });

  it('getEpaComplianceReport returns filtered chemical logs and handles errors', async () => {
    mPrismaClient.chemicalApplicationLog.findMany.mockResolvedValueOnce([
      { id: 'log-1', chemicalName: 'Termidor SC', quantityUsed: 2.5, unit: 'oz', epaRegistrationNo: '7969-210' },
    ]);
    const reply: any = {
      statusCode: 200,
      body: undefined,
      status(c: number) {
        this.statusCode = c;
        return this;
      },
      send(b: any) {
        this.body = b;
        return this;
      },
    };
    await getEpaComplianceReport(
      { user: { tenantId: 't-1' }, query: { startDate: '2026-01-01', endDate: '2026-12-31' } } as any,
      reply
    );
    expect(reply.statusCode).toBe(200);
    expect(reply.body).toBeDefined();
  });
});
