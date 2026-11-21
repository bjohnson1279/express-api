const mPrismaClient = {
  customer: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  notificationPreference: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  serviceContract: {
    findMany: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mPrismaClient),
}));

import { getCustomers, getCustomer, getPreferences } from '../src/domains/crm/customerController';
import { getContracts } from '../src/domains/crm/contractController';

function mockReply() {
  const res: any = { status: jest.fn(), send: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('CRM Customer & Contract Controllers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getCustomers scopes query by authenticated tenantId', async () => {
    mPrismaClient.customer.findMany.mockResolvedValueOnce([{ id: 'c-1', name: 'Alice' }]);
    const reply = mockReply();
    await getCustomers({ user: { tenantId: 't-1' } } as any, reply);
    expect(mPrismaClient.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user: { tenantId: 't-1' } } })
    );
    expect(reply.send).toHaveBeenCalledWith([{ id: 'c-1', name: 'Alice' }]);
  });

  it('getCustomer returns 404 when customer is outside tenant', async () => {
    mPrismaClient.customer.findFirst.mockResolvedValueOnce(null);
    const reply = mockReply();
    await getCustomer({ params: { id: 'c-other' }, user: { tenantId: 't-1' } } as any, reply);
    expect(reply.status).toHaveBeenCalledWith(404);
  });

  it('getPreferences returns 404 when customer is missing', async () => {
    mPrismaClient.customer.findFirst.mockResolvedValueOnce(null);
    const reply = mockReply();
    await getPreferences({ params: { id: 'c-missing' }, user: { tenantId: 't-1' } } as any, reply);
    expect(reply.status).toHaveBeenCalledWith(404);
  });

  it('getContracts returns tenant-scoped service contracts', async () => {
    mPrismaClient.serviceContract.findMany.mockResolvedValueOnce([{ id: 'sc-1', cadence: 'MONTHLY' }]);
    const reply = mockReply();
    await getContracts({ user: { tenantId: 't-1' } } as any, reply);
    expect(mPrismaClient.serviceContract.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't-1' } })
    );
    expect(reply.send).toHaveBeenCalledWith([{ id: 'sc-1', cadence: 'MONTHLY' }]);
  });
});
