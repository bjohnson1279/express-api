const mockStartNotif = jest.fn();
const mockStartPreVisit = jest.fn();
const mockStartHealth = jest.fn();
const mockStartJobGen = jest.fn();
const mockStartFollowUp = jest.fn();
const mockStartInventory = jest.fn();
const mockStartAutoCharge = jest.fn();

jest.mock('../src/shared/database', () => {
  const { AsyncLocalStorage } = require('node:async_hooks');
  return {
    databaseContext: new AsyncLocalStorage(),
    verifyDatabaseRoles: jest.fn().mockResolvedValue(undefined),
    authenticationClient: jest.fn(() => ({})),
    PrismaClient: jest.fn().mockImplementation(() => ({})),
  };
});

jest.mock('../src/domains/comms/NotificationCron', () => ({ startNotificationCron: () => mockStartNotif() }));
jest.mock('../src/domains/comms/PreVisitNotificationCron', () => ({ startPreVisitNotificationCron: () => mockStartPreVisit() }));
jest.mock('../src/domains/crm/HealthScoreCron', () => ({ startHealthScoreCron: () => mockStartHealth() }));
jest.mock('../src/domains/dispatch/JobGenerationCron', () => ({ startJobGenerationCron: () => mockStartJobGen() }));
jest.mock('../src/domains/sales/FollowUpCron', () => ({ startFollowUpCron: () => mockStartFollowUp() }));
jest.mock('../src/domains/dispatch/InventoryCron', () => ({ startInventoryCron: () => mockStartInventory() }));
jest.mock('../src/domains/billing/autoCharge', () => ({ startAutoChargeCron: () => mockStartAutoCharge() }));

const mockStripeWebhook = jest.fn(async (_req: any, reply: any) => reply.send({ received: true }));
jest.mock('../src/domains/billing/webhookController', () => ({
  stripeWebhook: (req: any, reply: any) => mockStripeWebhook(req, reply),
}));

jest.mock('../src/shared/middleware/rateLimiter', () => ({
  apiLimiter: async () => {},
}));
jest.mock('../src/shared/middleware/usageMetering', () => ({
  usageMetering: async () => {},
}));
jest.mock('../src/shared/middleware/auditMiddleware', () => ({
  auditMiddleware: async () => {},
}));

const mockVerifyToken = jest.fn(async (req: any, reply: any) => {
  if (!req.headers.authorization) return reply.code(401).send({ error: 'Unauthorized' });
  req.user = { id: 'u1', tenantId: 't1', role: req.headers['x-test-role'] || 'MANAGER' };
});
jest.mock('../src/shared/middleware/authMiddleware', () => ({
  verifyToken: (req: any, reply: any) => mockVerifyToken(req, reply),
  requireRole: (roles: string[]) => async (req: any, reply: any) => {
    if (!roles.includes(req.user?.role)) return reply.code(403).send({ error: 'Forbidden' });
  },
}));

import { startFastify } from '../src/index';

describe('Express API bootstrap (src/index.ts)', () => {
  let app: any;

  beforeAll(async () => {
    process.env.ENABLE_BACKGROUND_JOBS = 'true';
    app = await startFastify({ listen: false });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('starts all 7 background crons and serves /health without auth', async () => {
    expect(mockStartNotif).toHaveBeenCalledTimes(1);
    expect(mockStartPreVisit).toHaveBeenCalledTimes(1);
    expect(mockStartHealth).toHaveBeenCalledTimes(1);
    expect(mockStartJobGen).toHaveBeenCalledTimes(1);
    expect(mockStartFollowUp).toHaveBeenCalledTimes(1);
    expect(mockStartInventory).toHaveBeenCalledTimes(1);
    expect(mockStartAutoCharge).toHaveBeenCalledTimes(1);

    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', service: 'fastify-api' });
  });

  it('exempts /api/v1/webhooks/stripe from JWT auth and blocks unauthenticated protected routes', async () => {
    const webhookRes = await app.inject({ method: 'POST', url: '/api/v1/webhooks/stripe', payload: {} });
    expect(webhookRes.statusCode).toBe(200);
    expect(mockStripeWebhook).toHaveBeenCalled();

    const unauthRes = await app.inject({ method: 'GET', url: '/api/v1/customers' });
    expect(unauthRes.statusCode).toBe(401);

    const forbiddenRes = await app.inject({
      method: 'GET',
      url: '/api/v1/hr/staff',
      headers: { authorization: 'Bearer tok', 'x-test-role': 'CUSTOMER' },
    });
    expect(forbiddenRes.statusCode).toBe(403);
  });
});
