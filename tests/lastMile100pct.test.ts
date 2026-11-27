import fs from 'fs';

const mockPrisma: any = {
  $queryRaw: jest.fn(),
  $executeRawUnsafe: jest.fn(),
  serviceAgreement: { create: jest.fn(), update: jest.fn(), upsert: jest.fn(), findUnique: jest.fn() },
  chatConversation: { findFirst: jest.fn() },
  employeeDocument: { findFirst: jest.fn() },
};

jest.mock('../src/shared/database', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

jest.mock('pdfkit', () =>
  jest.fn().mockImplementation(() => ({
    pipe: jest.fn(),
    fontSize: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    moveDown: jest.fn().mockReturnThis(),
    end: jest.fn(),
  }))
);

import playbookRoutes from '../src/domains/crm/playbookRoutes';
import catalogRoutes from '../src/domains/crm/catalogRoutes';
import deviceRoutes from '../src/domains/crm/deviceRoutes';
import inspectionRoutes from '../src/domains/crm/inspectionRoutes';
import profitabilityRoutes from '../src/domains/crm/profitabilityRoutes';
import recurringRoutes from '../src/domains/crm/recurringRoutes';
import { saveMultipartUpload } from '../src/shared/multipartUpload';
import { auditMiddleware } from '../src/shared/middleware/auditMiddleware';
import { usageMetering } from '../src/shared/middleware/usageMetering';
import { AgreementService } from '../src/domains/sales/AgreementService';
import { ChatController } from '../src/domains/comms/chatController';
import { OnboardingController } from '../src/domains/hr/OnboardingController';

function mockReply() {
  const r: any = {
    statusCode: 200,
    body: undefined,
    header() { return this; },
    code(c: number) { this.statusCode = c; return this; },
    status(c: number) { this.statusCode = c; return this; },
    send(b: any) { this.body = b; return this; },
  };
  return r;
}

describe('Express Wave 29: last-mile route catches, multipartUpload, middleware catches, and AgreementService mkdir', () => {
  beforeEach(() => jest.clearAllMocks());

  it('covers error catch blocks across all 6 CRM Fastify route plugins', async () => {
    const plugins = [
      playbookRoutes,
      catalogRoutes,
      deviceRoutes,
      inspectionRoutes,
      profitabilityRoutes,
      recurringRoutes,
    ];
    for (const plugin of plugins) {
      const registered: any[] = [];
      const fakeApp: any = {
        route: jest.fn((def: any) => registered.push(def)),
      };
      await plugin(fakeApp, {} as any);
      expect(registered.length).toBeGreaterThan(0);

      const reply = mockReply();
      await registered[0].handler({ headers: {}, query: {}, body: {}, params: {} }, reply);
      expect(reply.statusCode).toBeGreaterThanOrEqual(400);
    }
  });

  it('covers saveMultipartUpload unexpected field, auditMiddleware & usageMetering DB catch, and AgreementService mkdir', async () => {
    const fakeReq: any = {
      parts: async function* () {
        yield { type: 'file', fieldname: 'wrongField', filename: 'a.png', toBuffer: async () => Buffer.from('x') };
      },
    };
    await expect(saveMultipartUpload(fakeReq, 'photo', '/tmp')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Unexpected file field',
    });

    mockPrisma.$executeRawUnsafe.mockRejectedValueOnce(new Error('audit db err'));
    await auditMiddleware(
      {
        method: 'POST',
        url: '/api/v1/jobs',
        ip: '127.0.0.1',
        headers: { 'user-agent': 'jest' },
        body: { a: 1 },
        params: {},
        user: { id: 'u1', tenantId: 't1', role: 'ADMIN' },
      } as any,
      mockReply()
    );

    mockPrisma.$executeRawUnsafe.mockRejectedValueOnce(new Error('metering db err'));
    await usageMetering(
      {
        method: 'GET',
        routeOptions: { url: '/api/v1/jobs' },
        user: { tenantId: 't1' },
      } as any,
      mockReply()
    );

    const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValueOnce(false);
    const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementationOnce((() => undefined) as any);
    const writeStreamSpy = jest.spyOn(fs, 'createWriteStream').mockReturnValueOnce({} as any);
    mockPrisma.serviceAgreement.upsert.mockResolvedValue({ id: 'ag-new' });
    mockPrisma.serviceAgreement.findUnique.mockResolvedValue({ id: 'ag-new', pdfUrl: '/api/v1/agreements/ag-new/pdf' });
    mockPrisma.serviceAgreement.update.mockResolvedValue({ id: 'ag-new', pdfUrl: '/api/v1/agreements/ag-new/pdf' });

    const svc = new AgreementService();
    const res = await svc.generateAgreement('t1', 'c1', 'p1', 'monthly', 100, new Date('2026-06-01'));
    expect(res).toBeTruthy();
    expect(mkdirSpy).toHaveBeenCalled();

    existsSpy.mockRestore();
    mkdirSpy.mockRestore();
    writeStreamSpy.mockRestore();

    // ChatController.sendMessage 404 (line 220)
    mockPrisma.chatConversation.findFirst.mockResolvedValueOnce(null);
    const rChat = mockReply();
    await ChatController.sendMessage(
      { params: { id: 'missing' }, body: { senderType: 'CSR', messageText: 'Hi' }, user: { tenantId: 't1', id: 'u1' } } as any,
      rChat
    );
    expect(rChat.statusCode).toBe(404);

    // OnboardingController.downloadDocument catch (line 24)
    mockPrisma.employeeDocument.findFirst.mockRejectedValueOnce(new Error('db err'));
    const rDoc = mockReply();
    await OnboardingController.downloadDocument(
      { params: { id: '11111111-1111-1111-1111-111111111111' }, user: { tenantId: 't1' } } as any,
      rDoc
    );
    expect(rDoc.statusCode).toBe(404);
  });
});
