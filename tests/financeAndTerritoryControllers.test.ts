const mockPrisma: any = {
  invoice: { findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  job: { update: jest.fn() },
  quote: { create: jest.fn(), findMany: jest.fn() },
  territory: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
};

jest.mock('../src/shared/database', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));

const mockSyncToErp = jest.fn();
jest.mock('../src/domains/billing/erpIntegration', () => ({
  syncToErp: (...args: any[]) => mockSyncToErp(...args),
}));

const mockAcceptExec = jest.fn();
const mockPaymentExec = jest.fn();
const mockReportExec = jest.fn();
const mockTerritoriesExec = jest.fn();

jest.mock('../src/infrastructure/billing/PrismaQuoteRepository', () => ({ PrismaQuoteRepository: jest.fn() }));
jest.mock('../src/infrastructure/billing/PrismaInvoiceRepository', () => ({ PrismaInvoiceRepository: jest.fn() }));
jest.mock('../src/infrastructure/billing/PrismaPaymentRepository', () => ({ PrismaPaymentRepository: jest.fn() }));
jest.mock('../src/infrastructure/sales/PrismaTerritoryRepository', () => ({ PrismaTerritoryRepository: jest.fn() }));

jest.mock('../src/application/billing/AcceptQuoteUseCase', () => ({
  AcceptQuoteUseCase: jest.fn().mockImplementation(() => ({ execute: (...a: any[]) => mockAcceptExec(...a) })),
}));
jest.mock('../src/application/billing/RecordPaymentUseCase', () => ({
  RecordPaymentUseCase: jest.fn().mockImplementation(() => ({ execute: (...a: any[]) => mockPaymentExec(...a) })),
}));
jest.mock('../src/application/billing/GetFinancialReportUseCase', () => ({
  GetFinancialReportUseCase: jest.fn().mockImplementation(() => ({ execute: (...a: any[]) => mockReportExec(...a) })),
}));
jest.mock('../src/application/sales/GetTerritoriesUseCase', () => ({
  GetTerritoriesUseCase: jest.fn().mockImplementation(() => ({ execute: (...a: any[]) => mockTerritoriesExec(...a) })),
}));

import {
  getFinancialReport,
  getInvoices,
  createInvoice,
  markInvoicePaid,
  createQuote,
  getQuotes,
  acceptQuote,
  recordPayment,
  triggerErpSync,
} from '../src/domains/billing/financeController';
import {
  getTerritories,
  getTerritoryById,
  createTerritory,
  updateTerritory,
  deleteTerritory,
  getTerritoryAnalytics,
} from '../src/domains/sales/territoryController';

function mockReply() {
  const r: any = {
    statusCode: 200,
    body: undefined,
    status(c: number) { this.statusCode = c; return this; },
    send(b: any) { this.body = b; return this; },
  };
  return r;
}

describe('Express API: financeController and territoryController full coverage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('covers all financeController handlers and error branches', async () => {
    mockReportExec.mockResolvedValueOnce({ mrr: 1000 });
    const r1 = mockReply();
    await getFinancialReport({ user: { tenantId: 't1' } } as any, r1);
    expect(r1.body.mrr).toBe(1000);

    mockReportExec.mockRejectedValueOnce(new Error('fail'));
    const r1e = mockReply();
    await getFinancialReport({ user: { tenantId: 't1' } } as any, r1e);
    expect(r1e.statusCode).toBe(500);

    mockPrisma.invoice.findMany.mockResolvedValueOnce([{ id: 'inv1' }]);
    const r2 = mockReply();
    await getInvoices({} as any, r2);
    expect(r2.body).toEqual([{ id: 'inv1' }]);

    mockPrisma.invoice.create.mockResolvedValueOnce({ id: 'inv2', status: 'unpaid' });
    mockPrisma.job.update.mockResolvedValueOnce({});
    const r3 = mockReply();
    await createInvoice({ body: { jobId: 'j1', totalAmount: 250 } } as any, r3);
    expect(r3.statusCode).toBe(201);

    mockPrisma.invoice.update.mockResolvedValueOnce({ id: 'inv2', status: 'paid' });
    const r4 = mockReply();
    await markInvoicePaid({ params: { id: 'inv2' } } as any, r4);
    expect(r4.body.status).toBe('paid');

    mockPrisma.quote.create.mockResolvedValueOnce({ id: 'q1', status: 'draft' });
    const r5 = mockReply();
    await createQuote({ body: { customerId: 'c1', propertyId: 'p1', totalAmount: 300 } } as any, r5);
    expect(r5.statusCode).toBe(201);

    mockPrisma.quote.findMany.mockResolvedValueOnce([{ id: 'q1' }]);
    const r6 = mockReply();
    await getQuotes({} as any, r6);
    expect(r6.body).toHaveLength(1);

    mockAcceptExec.mockResolvedValueOnce({ quote: { id: 'q1', status: 'accepted' } });
    const r7 = mockReply();
    await acceptQuote({ params: { id: 'q1' }, user: { tenantId: 't1' } } as any, r7);
    expect(r7.body.quote.status).toBe('accepted');

    mockAcceptExec.mockRejectedValueOnce(new Error('Quote not found'));
    const r7e = mockReply();
    await acceptQuote({ params: { id: 'q-missing' }, user: { tenantId: 't1' } } as any, r7e);
    expect(r7e.statusCode).toBe(404);

    mockPaymentExec.mockResolvedValueOnce({ id: 'pay1', amount: 250 });
    const r8 = mockReply();
    await recordPayment({ body: { invoiceId: 'inv2', customerId: 'c1', amount: '250', method: 'CARD' }, user: { tenantId: 't1' } } as any, r8);
    expect(r8.statusCode).toBe(201);

    mockPaymentExec.mockRejectedValueOnce(new Error('Invalid amount'));
    const r8e = mockReply();
    await recordPayment({ body: { amount: '-1' }, user: { tenantId: 't1' } } as any, r8e);
    expect(r8e.statusCode).toBe(400);

    mockSyncToErp.mockResolvedValueOnce({ status: 'synced' });
    const r9 = mockReply();
    await triggerErpSync({ body: { provider: 'QBO', resourceId: 'inv2', resourceType: 'INVOICE', payload: {} } } as any, r9);
    expect(r9.statusCode).toBe(201);

    // Remaining financeController error branches
    mockPrisma.invoice.findMany.mockRejectedValueOnce(new Error('db'));
    const re2 = mockReply(); await getInvoices({} as any, re2); expect(re2.statusCode).toBe(500);

    mockPrisma.invoice.create.mockRejectedValueOnce(new Error('db'));
    const re3 = mockReply(); await createInvoice({ body: { jobId: 'j1', totalAmount: 10 } } as any, re3); expect(re3.statusCode).toBe(500);

    mockPrisma.invoice.update.mockRejectedValueOnce(new Error('db'));
    const re4 = mockReply(); await markInvoicePaid({ params: { id: 'inv2' } } as any, re4); expect(re4.statusCode).toBe(500);

    mockPrisma.quote.create.mockRejectedValueOnce(new Error('db'));
    const re5 = mockReply(); await createQuote({ body: {} } as any, re5); expect(re5.statusCode).toBe(500);

    mockPrisma.quote.findMany.mockRejectedValueOnce(new Error('db'));
    const re6 = mockReply(); await getQuotes({} as any, re6); expect(re6.statusCode).toBe(500);

    mockSyncToErp.mockRejectedValueOnce(new Error('erp fail'));
    const re9 = mockReply(); await triggerErpSync({ body: {} } as any, re9); expect(re9.statusCode).toBe(500);
  });

  it('covers all territoryController handlers and analytics calculations', async () => {
    mockTerritoriesExec.mockResolvedValueOnce([{ id: 'ter1' }]);
    const r1 = mockReply();
    await getTerritories({ user: { tenantId: 't1' } } as any, r1);
    expect(r1.body).toEqual([{ id: 'ter1' }]);

    mockPrisma.territory.findUnique.mockResolvedValueOnce(null);
    const r2 = mockReply();
    await getTerritoryById({ params: { id: 'missing' } } as any, r2);
    expect(r2.statusCode).toBe(404);

    mockPrisma.territory.findUnique.mockResolvedValueOnce({ id: 'ter1', name: 'North' });
    const r3 = mockReply();
    await getTerritoryById({ params: { id: 'ter1' } } as any, r3);
    expect(r3.body.name).toBe('North');

    const rBad = mockReply();
    await createTerritory({ body: { name: 'North' } } as any, rBad);
    expect(rBad.statusCode).toBe(400);

    mockPrisma.territory.create.mockResolvedValueOnce({ id: 'ter2', name: 'South' });
    const r4 = mockReply();
    await createTerritory({ user: { tenantId: 't1' }, body: { name: 'South', polygonCoordinates: [[0, 0]], quotaTarget: '10' } } as any, r4);
    expect(r4.statusCode).toBe(201);

    mockPrisma.territory.update.mockResolvedValueOnce({ id: 'ter2', name: 'South Updated' });
    const r5 = mockReply();
    await updateTerritory({
      params: { id: 'ter2' },
      body: { name: 'South Updated', description: 'Desc', assignedRepId: 'u1', color: '#fff', polygonCoordinates: [[1, 1]], quotaTarget: '20', isActive: false },
    } as any, r5);
    expect(r5.body.name).toBe('South Updated');

    mockPrisma.territory.delete.mockResolvedValueOnce({});
    const r6 = mockReply();
    await deleteTerritory({ params: { id: 'ter2' } } as any, r6);
    expect(r6.body.success).toBe(true);

    mockPrisma.territory.findUnique.mockResolvedValueOnce(null);
    const r7a = mockReply();
    await getTerritoryAnalytics({ params: { id: 'missing' } } as any, r7a);
    expect(r7a.statusCode).toBe(404);

    mockPrisma.territory.findUnique.mockResolvedValueOnce({
      id: 'ter1',
      name: 'North',
      quotaTarget: 4,
      assignedRep: { id: 'u1', email: 'rep@test.com' },
      canvassPins: [
        { status: 'SOLD' },
        { status: 'SOLD' },
        { status: 'PITCHED' },
        { status: 'NOT_HOME' },
        { status: 'NOT_INTERESTED' },
      ],
      doNotKnockRecords: [{ id: 'dnk1' }],
    });
    const r7 = mockReply();
    await getTerritoryAnalytics({ params: { id: 'ter1' } } as any, r7);
    expect(r7.body.dealsClosed).toBe(2);
    expect(r7.body.quotaAttainmentPercent).toBe(50);
    expect(r7.body.doNotKnockCount).toBe(1);

    // Remaining territoryController error branches
    mockTerritoriesExec.mockRejectedValueOnce(new Error('db'));
    const te1 = mockReply(); await getTerritories({ user: { tenantId: 't1' } } as any, te1); expect(te1.statusCode).toBe(500);

    mockPrisma.territory.findUnique.mockRejectedValueOnce(new Error('db'));
    const te2 = mockReply(); await getTerritoryById({ params: { id: 'ter1' } } as any, te2); expect(te2.statusCode).toBe(500);

    mockPrisma.territory.create.mockRejectedValueOnce(new Error('db'));
    const te3 = mockReply(); await createTerritory({ user: { tenantId: 't1' }, body: { name: 'Bad', polygonCoordinates: [[0, 0]] } } as any, te3); expect(te3.statusCode).toBe(500);

    mockPrisma.territory.update.mockRejectedValueOnce(new Error('db'));
    const te4 = mockReply(); await updateTerritory({ params: { id: 'ter1' }, body: { name: 'X' } } as any, te4); expect(te4.statusCode).toBe(500);

    mockPrisma.territory.delete.mockRejectedValueOnce(new Error('db'));
    const te5 = mockReply(); await deleteTerritory({ params: { id: 'ter1' } } as any, te5); expect(te5.statusCode).toBe(500);

    mockPrisma.territory.findUnique.mockRejectedValueOnce(new Error('db'));
    const te6 = mockReply(); await getTerritoryAnalytics({ params: { id: 'ter1' } } as any, te6); expect(te6.statusCode).toBe(500);
  });
});
