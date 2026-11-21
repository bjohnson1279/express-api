const mPrismaClient: any = {
  $executeRawUnsafe: jest.fn().mockResolvedValue(1),
  serviceAgreement: {
    findUnique: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mPrismaClient),
}));

const mockJobCommand: jest.Mock = jest.fn();
const mockCallbackActor: jest.Mock = jest.fn(() => ({ id: 'u-1', tenantId: 't-1', role: 'MANAGER' }));
const mockPageHeaders: jest.Mock = jest.fn(() => ({ 'X-Page-Limit': '50', 'X-Has-More': 'false' }));

class MockCallbackError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

jest.mock('../src/domains/dispatch/jobService', () => ({
  callbackActor: (...args: any[]) => mockCallbackActor(...args),
  CallbackError: MockCallbackError,
  jobCommand: (...args: any[]) => mockJobCommand(...args),
  camelJob: (v: any) => v,
  pageHeaders: (...args: any[]) => mockPageHeaders(...args),
}));

const mockGenerateExecute = jest.fn();
const mockSignExecute = jest.fn();
const mockRepoSave = jest.fn();

jest.mock('../src/infrastructure/sales/PrismaServiceAgreementRepository', () => ({
  PrismaServiceAgreementRepository: jest.fn().mockImplementation(() => ({
    save: (...args: any[]) => mockRepoSave(...args),
  })),
}));

jest.mock('../src/application/sales/GenerateAgreementUseCase', () => ({
  GenerateAgreementUseCase: jest.fn().mockImplementation(() => ({
    execute: (...args: any[]) => mockGenerateExecute(...args),
  })),
}));

jest.mock('../src/application/sales/SignAgreementUseCase', () => ({
  SignAgreementUseCase: jest.fn().mockImplementation(() => ({
    execute: (...args: any[]) => mockSignExecute(...args),
  })),
}));

jest.mock('pdfkit', () => {
  return jest.fn().mockImplementation(() => ({
    pipe: jest.fn(),
    fontSize: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    end: jest.fn(),
  }));
});

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  createWriteStream: jest.fn(() => ({})),
}));

import {
  optimizeRoute,
  emergencyDispatch,
  autoSchedule,
  commitSchedule,
} from '../src/domains/dispatch/dispatchController';
import {
  getTechnicians,
  getTechnicianSchedule,
  updateLocation,
} from '../src/domains/dispatch/technicianController';
import { auditMiddleware } from '../src/shared/middleware/auditMiddleware';
import { usageMetering } from '../src/shared/middleware/usageMetering';
import { AgreementService } from '../src/domains/sales/AgreementService';

function mockReply() {
  const reply: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    header(k: string, v: string) {
      this.headers[k] = v;
      return this;
    },
    send(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return reply;
}

describe('Dispatch, Technicians, Middleware, and AgreementService (Express)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('dispatchController', () => {
    it('forwards optimize, emergency, auto_schedule, and commit_schedule commands', async () => {
      mockJobCommand.mockResolvedValue({ ok: true });
      const req: any = { headers: { authorization: 'Bearer tok' }, body: { date: '2026-11-21' } };

      for (const [fn, expectedAction] of [
        [optimizeRoute, 'optimize'],
        [emergencyDispatch, 'emergency'],
        [autoSchedule, 'auto_schedule'],
        [commitSchedule, 'commit_schedule'],
      ] as const) {
        const reply = mockReply();
        await fn(req, reply);
        expect(reply.body).toEqual({ ok: true });
        expect(mockJobCommand).toHaveBeenCalledWith(expect.any(Object), expectedAction, req.body);
      }
    });

    it('maps CallbackError and unexpected errors to status codes', async () => {
      mockJobCommand.mockRejectedValueOnce(new MockCallbackError(403, 'Forbidden'));
      const reply1 = mockReply();
      await optimizeRoute({ headers: {}, body: {} } as any, reply1);
      expect(reply1.statusCode).toBe(403);
      expect(reply1.body).toEqual({ error: 'Forbidden' });

      mockJobCommand.mockRejectedValueOnce(new Error('DB crash'));
      const reply2 = mockReply();
      await emergencyDispatch({ headers: {}, body: {} } as any, reply2);
      expect(reply2.statusCode).toBe(500);
      expect(reply2.body).toEqual({ error: 'Dispatch operation failed' });
    });
  });

  describe('technicianController', () => {
    it('lists technicians, gets paginated schedule with headers, and updates location', async () => {
      mockJobCommand.mockResolvedValueOnce([{ id: 'tech-1' }]);
      const r1 = mockReply();
      await getTechnicians({ headers: {}, params: {}, query: {}, body: {} } as any, r1);
      expect(r1.body).toEqual([{ id: 'tech-1' }]);

      mockJobCommand.mockResolvedValueOnce({ items: [{ id: 'j-1' }], hasMore: false });
      const r2 = mockReply();
      await getTechnicianSchedule({ headers: {}, params: { id: 'tech-1' }, query: { limit: 10 }, body: {} } as any, r2);
      expect(r2.headers['X-Page-Limit']).toBe('50');
      expect(r2.body).toEqual([{ id: 'j-1' }]);

      mockJobCommand.mockResolvedValueOnce({ id: 'tech-1', lat: 34.05, lng: -118.24 });
      const r3 = mockReply();
      await updateLocation({ headers: {}, params: { id: 'tech-1' }, body: { lat: 34.05, lng: -118.24 } } as any, r3);
      expect(r3.body).toEqual({ id: 'tech-1', lat: 34.05, lng: -118.24 });
    });

    it('returns error status on technician command failure', async () => {
      mockJobCommand.mockRejectedValueOnce(new MockCallbackError(401, 'Unauthorized'));
      const r = mockReply();
      await getTechnicians({ headers: {}, params: {}, query: {}, body: {} } as any, r);
      expect(r.statusCode).toBe(401);
      expect(r.body).toEqual({ error: 'Unauthorized' });
    });
  });

  describe('auditMiddleware & usageMetering', () => {
    it('writes audit log for mutating non-auth routes and skips GET/auth/health', async () => {
      const entityUuid = '11111111-1111-4111-8111-111111111111';
      await auditMiddleware(
        {
          method: 'PATCH',
          url: `/api/v1/customers/${entityUuid}?foo=bar`,
          user: { tenantId: 't-1', id: 'u-1', role: 'MANAGER' },
          ip: '127.0.0.1',
          headers: { 'user-agent': 'jest' },
          body: { name: 'Updated' },
        } as any,
        {} as any
      );
      expect(mPrismaClient.$executeRawUnsafe).toHaveBeenCalledTimes(1);
      expect(mPrismaClient.$executeRawUnsafe.mock.calls[0][5]).toBe('customers');
      expect(mPrismaClient.$executeRawUnsafe.mock.calls[0][6]).toBe(entityUuid);

      await auditMiddleware({ method: 'GET', url: '/api/v1/customers' } as any, {} as any);
      await auditMiddleware({ method: 'POST', url: '/api/v1/auth/login' } as any, {} as any);
      expect(mPrismaClient.$executeRawUnsafe).toHaveBeenCalledTimes(1);
    });

    it('records API usage metrics when tenantId and routeOptions are present', async () => {
      await usageMetering(
        {
          method: 'GET',
          user: { tenantId: '22222222-2222-4222-8222-222222222222' },
          routeOptions: { url: '/api/v1/jobs' },
        } as any,
        {} as any
      );
      expect(mPrismaClient.$executeRawUnsafe).toHaveBeenCalledTimes(1);

      await usageMetering({ method: 'GET' } as any, {} as any);
      expect(mPrismaClient.$executeRawUnsafe).toHaveBeenCalledTimes(1);
    });
  });

  describe('AgreementService', () => {
    it('generates PDF agreement, saves URL, and signs agreement', async () => {
      const setPdfUrl = jest.fn();
      mockGenerateExecute.mockResolvedValueOnce({ id: 'agr-1', setPdfUrl });
      mPrismaClient.serviceAgreement.findUnique.mockResolvedValueOnce({
        id: 'agr-1',
        pdfUrl: '/uploads/agreements/agr-1.pdf',
      });

      const svc = new AgreementService();
      const created = await svc.generateAgreement('t-1', 'c-1', 'p-1', 'MONTHLY', 149, new Date('2026-12-01'));
      expect(setPdfUrl).toHaveBeenCalledWith('/uploads/agreements/agr-1.pdf');
      expect(mockRepoSave).toHaveBeenCalledTimes(1);
      expect(created?.id).toBe('agr-1');

      mockSignExecute.mockResolvedValueOnce({ agreement: { id: 'agr-1' } });
      mPrismaClient.serviceAgreement.findUnique.mockResolvedValueOnce({ id: 'agr-1', status: 'SIGNED' });
      const signed = await svc.signAgreement('agr-1', '<svg/>');
      expect(signed?.status).toBe('SIGNED');
    });
  });
});
