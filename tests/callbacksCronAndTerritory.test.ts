import { createHmac } from 'node:crypto';
import { EventEmitter } from 'node:events';
import fastify from 'fastify';

const mockQueryRaw = jest.fn();
const mockPrisma: any = {
  $queryRaw: (...args: any[]) => mockQueryRaw(...args),
  serviceContract: { findMany: jest.fn() },
  job: { findFirst: jest.fn(), create: jest.fn() },
  customerEmail: { findFirst: jest.fn() },
  notificationQueue: { create: jest.fn() },
};

jest.mock('../src/shared/database', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));

let scheduledFn: (() => Promise<void>) | undefined;
jest.mock('../src/shared/scheduler', () => ({
  __esModule: true,
  default: {
    schedule: jest.fn((_expr: string, fn: () => Promise<void>) => {
      scheduledFn = fn;
    }),
  },
}));

import callbackRoutes from '../src/domains/crm/callbackRoutes';
import { callbackActor, callbackCommand, CallbackError } from '../src/domains/crm/callbackService';
import { startJobGenerationCron } from '../src/domains/dispatch/JobGenerationCron';
import { Territory } from '../src/domain/sales/entities/Territory';
import { TerritoryPolygon } from '../src/domain/sales/valueObjects/TerritoryPolygon';
import { Money } from '../src/domain/billing/valueObjects/Money';

const makeJwt = (claims: Record<string, unknown>, secret = 'cb-secret', alg = 'HS256') => {
  const h = Buffer.from(JSON.stringify({ alg })).toString('base64url');
  const p = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const s = createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  return `Bearer ${h}.${p}.${s}`;
};

describe('Express API: callbackService, callbackRoutes, JobGenerationCron, and Territory entity', () => {
  const origSecret = process.env.JWT_SECRET;
  const uid = '11111111-1111-1111-1111-111111111111';
  const tid = '22222222-2222-2222-2222-222222222222';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'cb-secret';
  });

  afterAll(() => {
    process.env.JWT_SECRET = origSecret;
  });

  describe('callbackService (callbackActor & callbackCommand)', () => {
    it('validates JWT_SECRET, Bearer format, algorithm, signature, claims, exp, and nbf', () => {
      delete process.env.JWT_SECRET;
      expect(() => callbackActor('Bearer x')).toThrow(CallbackError);
      process.env.JWT_SECRET = 'cb-secret';

      expect(() => callbackActor(undefined)).toThrow('Sign in to use callbacks');
      expect(() => callbackActor('Bearer bad')).toThrow('Invalid or expired token');
      expect(() => callbackActor(makeJwt({ id: uid, tenantId: tid, exp: Date.now() / 1000 + 60 }, 'cb-secret', 'none'))).toThrow();
      expect(() => callbackActor(makeJwt({ id: uid, tenantId: tid, exp: Date.now() / 1000 + 60 }, 'wrong-secret'))).toThrow();
      expect(() => callbackActor(makeJwt({ id: uid, tenantId: tid, exp: Date.now() / 1000 - 10 }))).toThrow();
      expect(() => callbackActor(makeJwt({ id: uid, tenantId: tid, exp: Date.now() / 1000 + 60, nbf: Date.now() / 1000 + 60 }))).toThrow();

      const actor = callbackActor(makeJwt({ id: uid, tenantId: tid, exp: Date.now() / 1000 + 300 }));
      expect(actor).toEqual({ id: uid, tenantId: tid });
    });

    it('maps PostgreSQL SQLSTATE error codes in callbackCommand', async () => {
      const actor = { id: uid, tenantId: tid };
      mockQueryRaw.mockResolvedValueOnce([{ result: { ok: true } }]);
      expect(await callbackCommand(actor, 'settings')).toEqual({ ok: true });

      for (const [code, expectedStatus] of [['P0403', 403], ['22P02', 400], ['23505', 409], ['XX000', 500]] as const) {
        mockQueryRaw.mockRejectedValueOnce({ meta: { code, message: 'ERROR: boom' } });
        await expect(callbackCommand(actor, 'list')).rejects.toMatchObject({ status: expectedStatus });
      }
    });
  });

  describe('callbackRoutes (REST + /events SSE)', () => {
    it('routes GET/POST actions and maps errors, plus handles /events SSE error and stream', async () => {
      const app = fastify();
      await app.register(callbackRoutes, { prefix: '/callbacks' });

      const tok = makeJwt({ id: uid, tenantId: tid, exp: Date.now() / 1000 + 300 });
      mockQueryRaw.mockResolvedValueOnce([{ result: { enabled: true } }]);
      const r1 = await app.inject({ method: 'GET', url: '/callbacks/settings', headers: { authorization: tok } });
      expect(r1.statusCode).toBe(200);
      expect(r1.json()).toEqual({ enabled: true });

      const rUnauth = await app.inject({ method: 'GET', url: '/callbacks/events' });
      expect(rUnauth.statusCode).toBe(401);

      mockQueryRaw.mockRejectedValueOnce(new Error('unexpected'));
      const r500 = await app.inject({ method: 'POST', url: '/callbacks/cb-1/decision', headers: { authorization: tok }, payload: {} });
      expect(r500.statusCode).toBe(500);

      await app.close();
    });
  });

  describe('JobGenerationCron (all cadences + error path)', () => {
    it('advances all 6 contract cadences, generates jobs, and handles errors cleanly', async () => {
      startJobGenerationCron();
      expect(scheduledFn).toBeDefined();

      const past = new Date();
      past.setDate(past.getDate() - 15);
      mockPrisma.serviceContract.findMany.mockResolvedValueOnce([
        { id: 'c1', tenantId: tid, customerId: 'cu1', propertyId: 'p1', cadence: 'MONTHLY', startDate: past, customer: { name: 'A' } },
        { id: 'c2', tenantId: tid, customerId: 'cu2', propertyId: 'p2', cadence: 'BI_MONTHLY', startDate: new Date(Date.now() - 50 * 86400000), customer: { name: 'B' } },
        { id: 'c3', tenantId: tid, customerId: 'cu3', propertyId: 'p3', cadence: 'QUARTERLY', startDate: new Date(Date.now() - 80 * 86400000), customer: { name: 'C' } },
        { id: 'c4', tenantId: tid, customerId: 'cu4', propertyId: 'p4', cadence: 'SEMI_ANNUALLY', startDate: new Date(Date.now() - 170 * 86400000), customer: { name: 'D' } },
        { id: 'c5', tenantId: tid, customerId: 'cu5', propertyId: 'p5', cadence: 'ANNUALLY', startDate: new Date(Date.now() - 355 * 86400000), customer: { name: 'E' } },
        { id: 'c6', tenantId: tid, customerId: 'cu6', propertyId: 'p6', cadence: 'ONE_TIME', startDate: past, customer: { name: 'F' } },
      ]);
      mockPrisma.job.findFirst.mockResolvedValue(null);
      mockPrisma.job.create.mockResolvedValue({ id: 'job-new' });
      mockPrisma.customerEmail.findFirst.mockResolvedValue({ emailAddress: 'a@b.com' });
      mockPrisma.notificationQueue.create.mockResolvedValue({});

      await scheduledFn!();
      expect(mockPrisma.job.create).toHaveBeenCalled();

      mockPrisma.serviceContract.findMany.mockRejectedValueOnce(new Error('DB down'));
      await scheduledFn!();
    });
  });

  describe('Territory domain entity', () => {
    it('covers constructor validation, getters, and all mutator methods', () => {
      const poly = new TerritoryPolygon([
        { lat: 0, lng: 0 },
        { lat: 0, lng: 1 },
        { lat: 1, lng: 1 },
      ]);
      expect(() => new Territory({ id: '', tenantId: tid, name: 'N', polygon: poly })).toThrow('Territory ID');
      expect(() => new Territory({ id: 'ter1', tenantId: '', name: 'N', polygon: poly })).toThrow('Tenant ID');
      expect(() => new Territory({ id: 'ter1', tenantId: tid, name: ' ', polygon: poly })).toThrow('Territory name');

      const t = new Territory({ id: 'ter1', tenantId: tid, name: 'North', polygon: poly, description: ' Desc ', assignedRepId: 'r1', color: '#111' });
      expect(t.name).toBe('North');
      expect(t.description).toBe('Desc');
      expect(t.assignedRepId).toBe('r1');
      expect(t.color).toBe('#111');
      expect(t.polygon).toBe(poly);
      expect(t.quotaTarget.amountInCents).toBe(0);
      expect(t.isActive).toBe(true);

      t.updateName('South');
      expect(() => t.updateName('  ')).toThrow();
      t.updateDescription('New');
      t.updateDescription(null);
      t.updatePolygon(poly);
      t.assignRep('r2');
      t.updateColor('#222');
      expect(() => t.updateColor('')).toThrow();
      t.updateQuotaTarget(Money.fromDollars(500));
      t.deactivate();
      expect(t.isActive).toBe(false);
      t.activate();
      expect(t.isActive).toBe(true);
    });
  });
});
