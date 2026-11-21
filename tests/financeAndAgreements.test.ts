const mPrismaClient = {
  invoice: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  job: {
    update: jest.fn(),
  },
  quote: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  erpSyncLog: {
    create: jest.fn(),
  },
  serviceContract: {
    findMany: jest.fn(),
  },
  commission: {
    findMany: jest.fn(),
  },
  payment: {
    create: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mPrismaClient),
}));

import {
  getInvoices,
  createInvoice,
  markInvoicePaid,
  createQuote,
  getQuotes,
  triggerErpSync,
} from '../src/domains/billing/financeController';
import { downloadAgreement } from '../src/domains/sales/AgreementController';

function mockReply() {
  const res: any = {
    status: jest.fn(),
    send: jest.fn(),
    type: jest.fn(),
    header: jest.fn(),
  };
  res.status.mockReturnValue(res);
  res.type.mockReturnValue(res);
  res.header.mockReturnValue(res);
  return res;
}

describe('Finance & Agreement Controllers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getInvoices returns ordered invoices', async () => {
    mPrismaClient.invoice.findMany.mockResolvedValueOnce([{ id: 'inv-1', totalAmount: 250, status: 'unpaid' }]);
    const reply = mockReply();
    await getInvoices({} as any, reply);
    expect(reply.send).toHaveBeenCalledWith([{ id: 'inv-1', totalAmount: 250, status: 'unpaid' }]);
  });

  it('createInvoice creates invoice and marks job as invoiced', async () => {
    mPrismaClient.invoice.create.mockResolvedValueOnce({ id: 'inv-2', jobId: 'job-1', totalAmount: 300, status: 'unpaid' });
    mPrismaClient.job.update.mockResolvedValueOnce({ id: 'job-1', status: 'invoiced' });
    const reply = mockReply();
    await createInvoice({ body: { jobId: 'job-1', totalAmount: 300 } } as any, reply);
    expect(mPrismaClient.job.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { status: 'invoiced' },
    });
    expect(reply.status).toHaveBeenCalledWith(201);
  });

  it('markInvoicePaid updates invoice status to paid', async () => {
    mPrismaClient.invoice.update.mockResolvedValueOnce({ id: 'inv-2', status: 'paid' });
    const reply = mockReply();
    await markInvoicePaid({ params: { id: 'inv-2' } } as any, reply);
    expect(reply.send).toHaveBeenCalledWith({ id: 'inv-2', status: 'paid' });
  });

  it('createQuote and getQuotes manage draft quotes', async () => {
    mPrismaClient.quote.create.mockResolvedValueOnce({ id: 'q-1', status: 'draft', totalAmount: 199 });
    const createReply = mockReply();
    await createQuote({ body: { customerId: 'c-1', propertyId: 'p-1', totalAmount: 199 } } as any, createReply);
    expect(createReply.status).toHaveBeenCalledWith(201);

    mPrismaClient.quote.findMany.mockResolvedValueOnce([{ id: 'q-1', status: 'draft' }]);
    const listReply = mockReply();
    await getQuotes({} as any, listReply);
    expect(listReply.send).toHaveBeenCalledWith([{ id: 'q-1', status: 'draft' }]);
  });

  it('triggerErpSync logs ERP sync and returns 201', async () => {
    mPrismaClient.erpSyncLog.create.mockResolvedValueOnce({ id: 'log-1', provider: 'quickbooks', status: 'success' });
    const reply = mockReply();
    await triggerErpSync(
      { body: { provider: 'quickbooks', resourceId: 'inv-1', resourceType: 'invoice', payload: {} } } as any,
      reply
    );
    expect(reply.status).toHaveBeenCalledWith(201);
  });

  it('downloadAgreement rejects invalid UUIDs with 400 and missing PDFs with 404', async () => {
    const badReply = mockReply();
    await downloadAgreement({ params: { id: '../../etc/passwd' } } as any, badReply);
    expect(badReply.status).toHaveBeenCalledWith(400);

    const missingReply = mockReply();
    await downloadAgreement({ params: { id: '11111111-1111-4111-8111-111111111111' } } as any, missingReply);
    expect(missingReply.status).toHaveBeenCalledWith(404);
  });
});
