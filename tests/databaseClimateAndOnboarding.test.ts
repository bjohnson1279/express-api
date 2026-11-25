import { EventEmitter } from 'events';
import https from 'https';
import fs from 'fs';
import { unlink } from 'fs/promises';
import path from 'path';

const mockSaveMultipart = jest.fn();
jest.mock('../src/shared/multipartUpload', () => ({
  saveMultipartUpload: (...args: any[]) => mockSaveMultipart(...args),
}));

jest.mock('fs/promises', () => ({
  unlink: jest.fn().mockResolvedValue(undefined),
}));

const mockPrisma: any = {
  employeeDocument: { findFirst: jest.fn(), create: jest.fn() },
  user: { findFirst: jest.fn() },
  employeeOnboardingTask: { findFirst: jest.fn(), update: jest.fn(), findMany: jest.fn() },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation((opts?: any) => ({
    ...mockPrisma,
    __opts: opts,
    $queryRaw: jest.fn().mockResolvedValue([{ name: 'servicing_crm_runtime', rolsuper: false, rolbypassrls: false }]),
    $transaction: jest.fn(async (arg: any) => {
      if (typeof arg === 'function') {
        return arg({ $queryRaw: jest.fn().mockResolvedValue([]) });
      }
      return Promise.all(arg);
    }),
    $extends: jest.fn((ext: any) => ({
      __ext: ext,
      customMethod: jest.fn(() => 'bound'),
    })),
  })),
}));

import { ClimateService } from '../src/domains/analytics/ClimateService';
import { OnboardingController } from '../src/domains/hr/OnboardingController';

function mockReply() {
  const reply: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined,
    status(c: number) { this.statusCode = c; return this; },
    header(k: string, v: string) { this.headers[k] = v; return this; },
    send(b: any) { this.body = b; return this; },
  };
  return reply;
}

describe('Express API: shared/database.ts, ClimateService, and OnboardingController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('shared/database.ts (RLS proxy, worker context, transactions, role verification)', () => {
    const origEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...origEnv };
      jest.resetModules();
    });

    it('covers production RLS extension proxy, interactive transactions, worker context, auth client, and role verification', async () => {
      jest.resetModules();
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgres://runtime';
      process.env.AUTH_DATABASE_URL = '';
      process.env.WORKER_DATABASE_URL = '';

      const dbMod = require('../src/shared/database');
      expect(() => dbMod.authenticationClient()).toThrow('Authentication database access is not configured');

      process.env.AUTH_DATABASE_URL = 'postgres://auth';
      expect(dbMod.authenticationClient()).toBeDefined();

      const client: any = new dbMod.PrismaClient();
      expect(client.customMethod()).toBe('bound');

      // Non-function $transaction rejected
      expect(() => client.$transaction([])).toThrow('Use an interactive transaction');

      // Interactive $transaction in request context
      const txRes = await dbMod.databaseContext.run({ jwt: 'jwt-123' }, () =>
        client.$transaction(async () => 'tx-ok')
      );
      expect(txRes).toBe('tx-ok');

      // Worker context fails if WORKER_DATABASE_URL unset, then succeeds when set
      expect(() =>
        dbMod.inWorkerContext(() => client.$transaction(async () => 'w'))
      ).toThrow('Worker database access is not configured');

      process.env.WORKER_DATABASE_URL = 'postgres://worker';
      const workerTx = await dbMod.inWorkerContext(() => client.$transaction(async () => 'worker-ok'));
      expect(workerTx).toBe('worker-ok');

      // Trigger $allOperations query hook in request & worker contexts
      const allOps = client.__ext.query.$allOperations;
      const reqOp = await dbMod.databaseContext.run({ jwt: 'jwt-abc' }, () =>
        allOps({ model: 'Job', operation: 'findMany', args: {}, query: jest.fn().mockResolvedValue(['j1']) })
      );
      expect(reqOp).toEqual(['j1']);

      const workerOp = await dbMod.inWorkerContext(() =>
        allOps({ model: 'User', operation: 'findFirst', args: { where: {} }, query: jest.fn() })
      );
      expect(workerOp).toBeUndefined();

      // verifyDatabaseRoles no-op when not required
      process.env.DATABASE_ISOLATION_REQUIRED = 'false';
      await expect(dbMod.verifyDatabaseRoles()).resolves.toBeUndefined();

      // verifyDatabaseRoles throws on mismatched role
      process.env.DATABASE_ISOLATION_REQUIRED = 'true';
      await expect(dbMod.verifyDatabaseRoles()).rejects.toThrow('Unsafe database role configuration');
    });
  });

  describe('ClimateService full branch coverage', () => {
    it('translates all WMO weather codes and evaluates all pest impact thresholds', () => {
      expect(ClimateService.getWeatherDescription(0)).toBe('Clear Sky');
      expect(ClimateService.getWeatherDescription(1)).toBe('Mainly Clear');
      expect(ClimateService.getWeatherDescription(2)).toBe('Partly Cloudy');
      expect(ClimateService.getWeatherDescription(3)).toBe('Overcast');
      expect(ClimateService.getWeatherDescription(45)).toContain('Fog');
      expect(ClimateService.getWeatherDescription(53)).toBe('Drizzle');
      expect(ClimateService.getWeatherDescription(63)).toContain('Rain (Sustained)');
      expect(ClimateService.getWeatherDescription(75)).toContain('Snow');
      expect(ClimateService.getWeatherDescription(81)).toBe('Rain Showers');
      expect(ClimateService.getWeatherDescription(96)).toBe('Thunderstorm');
      expect(ClimateService.getWeatherDescription(999)).toBe('Ambient Weather');

      const hotWetWindy = ClimateService.evaluatePestImpact(92, 80, 0.5, 20);
      expect(hotWetWindy).toContain('Excessive heat');
      expect(hotWetWindy).toContain('High relative humidity');
      expect(hotWetWindy).toContain('Recent precipitation');
      expect(hotWetWindy).toContain('High winds');

      const coldDry = ClimateService.evaluatePestImpact(40, 30, 0, 5);
      expect(coldDry).toContain('Low ambient temperature');
      expect(coldDry).toContain('Low humidity');

      const mild = ClimateService.evaluatePestImpact(70, 55, 0, 5);
      expect(mild).toContain('Optimal temperature range');
    });

    it('covers seasonal fallback climates and Open-Meteo success, cache, error, timeout, and bad payloads', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-07-15T12:00:00Z'));
      expect(ClimateService.getFallbackClimate(35, -105).temperature).toBe(86);
      jest.setSystemTime(new Date('2026-01-15T12:00:00Z'));
      expect(ClimateService.getFallbackClimate(35, -105).temperature).toBe(42);
      jest.setSystemTime(new Date('2026-04-15T12:00:00Z'));
      expect(ClimateService.getFallbackClimate(35, -105).temperature).toBe(72);
      jest.useRealTimers();

      const getSpy = jest.spyOn(https, 'get');

      // 1. Non-200 status -> fallback
      getSpy.mockImplementationOnce((_u: any, _o: any, cb: any) => {
        const res = new EventEmitter() as any;
        res.statusCode = 502;
        cb(res);
        return new EventEmitter() as any;
      });
      const r1 = await ClimateService.getClimateData(10.123, -20.456);
      expect(r1.source).toBe('offline-ambient-fallback');

      // 2. Missing current -> fallback
      getSpy.mockImplementationOnce((_u: any, _o: any, cb: any) => {
        const res = new EventEmitter() as any;
        res.statusCode = 200;
        cb(res);
        res.emit('data', JSON.stringify({}));
        res.emit('end');
        return new EventEmitter() as any;
      });
      expect((await ClimateService.getClimateData(11.1, -21.2)).source).toBe('offline-ambient-fallback');

      // 3. Invalid JSON -> fallback
      getSpy.mockImplementationOnce((_u: any, _o: any, cb: any) => {
        const res = new EventEmitter() as any;
        res.statusCode = 200;
        cb(res);
        res.emit('data', '{bad-json');
        res.emit('end');
        return new EventEmitter() as any;
      });
      expect((await ClimateService.getClimateData(12.1, -22.2)).source).toBe('offline-ambient-fallback');

      // 4. Network error -> fallback
      getSpy.mockImplementationOnce(() => {
        const req = new EventEmitter() as any;
        process.nextTick(() => req.emit('error', new Error('ECONNRESET')));
        return req;
      });
      expect((await ClimateService.getClimateData(13.1, -23.2)).source).toBe('offline-ambient-fallback');

      // 5. Timeout -> destroys request & fallback
      getSpy.mockImplementationOnce(() => {
        const req = new EventEmitter() as any;
        req.destroy = jest.fn();
        process.nextTick(() => req.emit('timeout'));
        return req;
      });
      expect((await ClimateService.getClimateData(14.1, -24.2)).source).toBe('offline-ambient-fallback');

      // 6. Live Open-Meteo success + cache hit
      getSpy.mockImplementationOnce((_u: any, _o: any, cb: any) => {
        const res = new EventEmitter() as any;
        res.statusCode = 200;
        cb(res);
        res.emit('data', JSON.stringify({ current: { temperature_2m: 88, relative_humidity_2m: 75, precipitation: 0.4, wind_speed_10m: 18, weather_code: 95 } }));
        res.emit('end');
        return new EventEmitter() as any;
      });
      const live = await ClimateService.getClimateData(40.5, -105.5);
      expect(live.source).toBe('open-meteo');
      expect(live.cached).toBe(false);
      const cached = await ClimateService.getClimateData(40.5, -105.5);
      expect(cached.cached).toBe(true);
    });
  });

  describe('OnboardingController', () => {
    it('handles downloadDocument validation, missing DB record, path traversal, and valid stream', async () => {
      const r1 = mockReply();
      await OnboardingController.downloadDocument({ params: { id: 'not-a-uuid' }, user: { tenantId: 't1' } } as any, r1);
      expect(r1.statusCode).toBe(404);

      const uuid = '11111111-1111-1111-1111-111111111111';
      mockPrisma.employeeDocument.findFirst.mockResolvedValueOnce(null);
      const r2 = mockReply();
      await OnboardingController.downloadDocument({ params: { id: uuid }, user: { tenantId: 't1' } } as any, r2);
      expect(r2.statusCode).toBe(404);

      const uploadDir = path.join(process.cwd(), 'uploads/onboarding');
      const goodFile = path.join(uploadDir, 'doc.pdf');
      mockPrisma.employeeDocument.findFirst.mockResolvedValueOnce({ filePath: goodFile });
      jest.spyOn(fs.promises, 'realpath')
        .mockResolvedValueOnce(goodFile)
        .mockResolvedValueOnce(uploadDir);
      jest.spyOn(fs.promises, 'stat').mockResolvedValueOnce({ isFile: () => true } as any);
      jest.spyOn(fs, 'createReadStream').mockReturnValueOnce('stream-data' as any);

      const r3 = mockReply();
      await OnboardingController.downloadDocument({ params: { id: uuid }, user: { tenantId: 't1' } } as any, r3);
      expect(r3.statusCode).toBe(200);
      expect(r3.body).toBe('stream-data');
      expect(r3.headers['Cache-Control']).toBe('no-store');
    });

    it('handles uploadDocument success, task completion, missing owner cleanup, and errors', async () => {
      mockSaveMultipart.mockResolvedValueOnce({
        filepath: '/tmp/a.pdf',
        fields: { userId: 'u1', taskId: 'task-1', documentType: 'W4' },
      });
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);
      mockPrisma.employeeOnboardingTask.findFirst.mockResolvedValueOnce(null);

      const r1 = mockReply();
      await OnboardingController.uploadDocument({ user: { tenantId: 't1' } } as any, r1);
      expect(r1.statusCode).toBe(404);
      expect(unlink).toHaveBeenCalledWith('/tmp/a.pdf');

      mockSaveMultipart.mockResolvedValueOnce({
        filepath: '/tmp/b.pdf',
        fields: { userId: 'u1', taskId: 'task-1', documentType: 'I9' },
      });
      mockPrisma.user.findFirst.mockResolvedValueOnce({ id: 'u1' });
      mockPrisma.employeeOnboardingTask.findFirst.mockResolvedValueOnce({ id: 'task-1' });
      mockPrisma.employeeDocument.create.mockResolvedValueOnce({ id: 'doc-1' });
      mockPrisma.employeeOnboardingTask.update.mockResolvedValueOnce({ id: 'task-1', status: 'completed' });

      const r2 = mockReply();
      await OnboardingController.uploadDocument({ user: { tenantId: 't1' } } as any, r2);
      expect(r2.statusCode).toBe(201);
      expect(r2.body).toEqual({ success: true, document: { id: 'doc-1' } });

      mockSaveMultipart.mockRejectedValueOnce(Object.assign(new Error('Too large'), { statusCode: 413 }));
      const r3 = mockReply();
      await OnboardingController.uploadDocument({ user: { tenantId: 't1' } } as any, r3);
      expect(r3.statusCode).toBe(413);
    });

    it('handles getTasks success and error', async () => {
      mockPrisma.employeeOnboardingTask.findMany.mockResolvedValueOnce([{ id: 't1' }]);
      const r1 = mockReply();
      await OnboardingController.getTasks({ params: { userId: 'u1' }, user: { tenantId: 't1' } } as any, r1);
      expect(r1.body).toEqual({ tasks: [{ id: 't1' }] });

      mockPrisma.employeeOnboardingTask.findMany.mockRejectedValueOnce(new Error('DB down'));
      const r2 = mockReply();
      await OnboardingController.getTasks({ params: { userId: 'u1' }, user: { tenantId: 't1' } } as any, r2);
      expect(r2.statusCode).toBe(500);
    });
  });
});
