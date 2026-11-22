const mPrismaClient: any = {
  employeeDocument: { findFirst: jest.fn(), create: jest.fn() },
  user: { findFirst: jest.fn() },
  employeeOnboardingTask: { findFirst: jest.fn(), update: jest.fn(), findMany: jest.fn() },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mPrismaClient),
}));

const mockSaveMultipartUpload = jest.fn();
jest.mock('../src/shared/multipartUpload', () => ({
  saveMultipartUpload: (...args: any[]) => mockSaveMultipartUpload(...args),
}));

const mockUnlink = jest.fn().mockResolvedValue(undefined);
jest.mock('fs/promises', () => ({
  unlink: (...args: any[]) => mockUnlink(...args),
}));

const mockRealpath: jest.Mock = jest.fn();
const mockStat: jest.Mock = jest.fn();
const mockCreateReadStream: jest.Mock = jest.fn(() => 'mock-stream');
jest.mock('fs', () => ({
  promises: {
    realpath: (...args: any[]) => mockRealpath(...args),
    stat: (...args: any[]) => mockStat(...args),
  },
  createReadStream: (...args: any[]) => mockCreateReadStream(...args),
}));

import path from 'path';
import { OnboardingController } from '../src/domains/hr/OnboardingController';
import { requireRole } from '../src/shared/middleware/authMiddleware';
import { startAutoChargeCron } from '../src/domains/billing/autoCharge';
import cron from '../src/shared/scheduler';

function mockReply() {
  const reply: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined,
    status(c: number) {
      this.statusCode = c;
      return this;
    },
    header(k: string, v: string) {
      this.headers[k] = v;
      return this;
    },
    send(b: any) {
      this.body = b;
      return this;
    },
  };
  return reply;
}

describe('OnboardingController Upload & Download Flows (Express)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uploadDocument saves document, completes task, and unlinks on missing owner/task', async () => {
    mockSaveMultipartUpload.mockResolvedValueOnce({
      filepath: '/tmp/uploads/onboarding/doc.pdf',
      fields: { userId: 'u-1', taskId: 'task-1', documentType: 'LICENSE' },
    });
    mPrismaClient.user.findFirst.mockResolvedValueOnce({ id: 'u-1' });
    mPrismaClient.employeeOnboardingTask.findFirst.mockResolvedValueOnce({ id: 'task-1' });
    mPrismaClient.employeeDocument.create.mockResolvedValueOnce({ id: 'doc-1' });
    mPrismaClient.employeeOnboardingTask.update.mockResolvedValueOnce({ id: 'task-1', status: 'completed' });

    const rOk = mockReply();
    await OnboardingController.uploadDocument({ user: { tenantId: 't-1' } } as any, rOk);
    expect(rOk.statusCode).toBe(201);
    expect(rOk.body.success).toBe(true);
    expect(mPrismaClient.employeeOnboardingTask.update).toHaveBeenCalledTimes(1);

    mockSaveMultipartUpload.mockResolvedValueOnce({
      filepath: '/tmp/uploads/onboarding/bad.pdf',
      fields: { userId: 'missing', taskId: 'task-1', documentType: 'LICENSE' },
    });
    mPrismaClient.user.findFirst.mockResolvedValueOnce(null);
    mPrismaClient.employeeOnboardingTask.findFirst.mockResolvedValueOnce(null);

    const r404 = mockReply();
    await OnboardingController.uploadDocument({ user: { tenantId: 't-1' } } as any, r404);
    expect(r404.statusCode).toBe(404);
    expect(mockUnlink).toHaveBeenCalledWith('/tmp/uploads/onboarding/bad.pdf');

    mockSaveMultipartUpload.mockRejectedValueOnce(Object.assign(new Error('File too large'), { statusCode: 413 }));
    const r413 = mockReply();
    await OnboardingController.uploadDocument({ user: { tenantId: 't-1' } } as any, r413);
    expect(r413.statusCode).toBe(413);
  });

  it('downloadDocument validates UUID, checks DB, verifies path root, and streams file', async () => {
    const validUuid = '11111111-1111-4111-8111-111111111111';
    const rootDir = path.join(process.cwd(), 'uploads', 'onboarding');
    const safeFile = path.join(rootDir, 'license.pdf');

    mPrismaClient.employeeDocument.findFirst.mockResolvedValueOnce(null);
    const rMissing = mockReply();
    await OnboardingController.downloadDocument(
      { params: { id: validUuid }, user: { tenantId: 't-1' } } as any,
      rMissing
    );
    expect(rMissing.statusCode).toBe(404);

    mPrismaClient.employeeDocument.findFirst.mockResolvedValueOnce({ filePath: safeFile });
    mockRealpath.mockResolvedValueOnce(safeFile).mockResolvedValueOnce(rootDir);
    mockStat.mockResolvedValueOnce({ isFile: () => true });

    const rStream = mockReply();
    await OnboardingController.downloadDocument(
      { params: { id: validUuid }, user: { tenantId: 't-1' } } as any,
      rStream
    );
    expect(rStream.statusCode).toBe(200);
    expect(rStream.headers['Cache-Control']).toBe('no-store');
    expect(rStream.body).toBe('mock-stream');

    // Traversal outside onboarding root -> 404
    mPrismaClient.employeeDocument.findFirst.mockResolvedValueOnce({ filePath: '/etc/passwd' });
    mockRealpath.mockResolvedValueOnce('/etc/passwd').mockResolvedValueOnce(rootDir);
    const rTraversal = mockReply();
    await OnboardingController.downloadDocument(
      { params: { id: validUuid }, user: { tenantId: 't-1' } } as any,
      rTraversal
    );
    expect(rTraversal.statusCode).toBe(404);
  });

  it('requireRole enforces 401/403 and allows permitted roles, and startAutoChargeCron schedules task', async () => {
    const guard = requireRole(['MANAGER', 'SUPER_ADMIN']);

    const r401 = mockReply();
    await guard({} as any, r401);
    expect(r401.statusCode).toBe(401);

    const r403 = mockReply();
    await guard({ user: { id: 'u-1', tenantId: 't-1', role: 'TECHNICIAN' } } as any, r403);
    expect(r403.statusCode).toBe(403);

    const rOk = mockReply();
    await guard({ user: { id: 'u-1', tenantId: 't-1', role: 'MANAGER' } } as any, rOk);
    expect(rOk.statusCode).toBe(200);

    const spy = jest.spyOn(cron, 'schedule').mockImplementation(((_expr: string, fn: any) => {
      fn();
      return {} as any;
    }) as any);
    startAutoChargeCron();
    expect(spy).toHaveBeenCalledWith('0 0 * * *', expect.any(Function));
    spy.mockRestore();
  });
});
