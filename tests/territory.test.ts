const mPrismaClient = {
  territory: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  canvassPin: {
    findMany: jest.fn(),
  },
  doNotKnockRecord: {
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mPrismaClient),
}));

import {
  getTerritoryById,
  createTerritory,
  updateTerritory,
  deleteTerritory,
  getTerritoryAnalytics,
  getDoNotKnockList,
  createDoNotKnock,
  deleteDoNotKnock,
} from '../src/domains/sales/territoryController';

function mockReply() {
  const res: any = {
    status: jest.fn(),
    send: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

describe('Territory & Do-Not-Knock Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getTerritoryById returns 404 when territory does not exist', async () => {
    mPrismaClient.territory.findUnique.mockResolvedValueOnce(null);
    const reply = mockReply();
    await getTerritoryById({ params: { id: 'missing-id' } } as any, reply);
    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Territory not found' });
  });

  it('createTerritory validates required fields and creates a territory', async () => {
    const badReply = mockReply();
    await createTerritory({ user: { tenantId: 't-1' }, body: { name: 'North' } } as any, badReply);
    expect(badReply.status).toHaveBeenCalledWith(400);

    const created = { id: 'ter-1', name: 'North', quotaTarget: 50 };
    mPrismaClient.territory.create.mockResolvedValueOnce(created);
    const okReply = mockReply();
    await createTerritory(
      {
        user: { tenantId: 't-1' },
        body: { name: 'North', polygonCoordinates: [[0, 0], [0, 1], [1, 1]], quotaTarget: '50' },
      } as any,
      okReply
    );
    expect(okReply.status).toHaveBeenCalledWith(201);
    expect(okReply.send).toHaveBeenCalledWith(created);
  });

  it('updateTerritory and deleteTerritory mutate territory records', async () => {
    mPrismaClient.territory.update.mockResolvedValueOnce({ id: 'ter-1', name: 'North Updated' });
    const updReply = mockReply();
    await updateTerritory({ params: { id: 'ter-1' }, body: { name: 'North Updated', quotaTarget: '100' } } as any, updReply);
    expect(updReply.send).toHaveBeenCalledWith({ id: 'ter-1', name: 'North Updated' });

    mPrismaClient.territory.delete.mockResolvedValueOnce({});
    const delReply = mockReply();
    await deleteTerritory({ params: { id: 'ter-1' } } as any, delReply);
    expect(delReply.send).toHaveBeenCalledWith({ success: true, message: 'Territory deleted successfully' });
  });

  it('getTerritoryAnalytics computes attainment and penetration rates', async () => {
    mPrismaClient.territory.findUnique.mockResolvedValueOnce({
      id: 'ter-1',
      name: 'West Zone',
      quotaTarget: 10,
      assignedRep: { id: 'rep-1', email: 'rep@example.com' },
      canvassPins: [
        { status: 'SOLD' },
        { status: 'SOLD' },
        { status: 'PITCHED' },
        { status: 'NOT_HOME' },
      ],
      doNotKnockRecords: [{ id: 'dnk-1' }],
    });
    const reply = mockReply();
    await getTerritoryAnalytics({ params: { id: 'ter-1' } } as any, reply);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        territoryId: 'ter-1',
        dealsClosed: 2,
        quotaAttainmentPercent: 20,
        totalDoorsKnocked: 4,
        leadsPitched: 1,
        notHomeCount: 1,
        doNotKnockCount: 1,
        penetrationRate: 50,
      })
    );
  });

  it('DNK list, create validation, and delete work properly', async () => {
    mPrismaClient.doNotKnockRecord.findMany.mockResolvedValueOnce([{ id: 'dnk-1', address: '123 Elm' }]);
    const listReply = mockReply();
    await getDoNotKnockList({ user: { tenantId: 't-1' } } as any, listReply);
    expect(listReply.send).toHaveBeenCalledWith([{ id: 'dnk-1', address: '123 Elm' }]);

    const badCreate = mockReply();
    await createDoNotKnock({ user: { tenantId: 't-1' }, body: {} } as any, badCreate);
    expect(badCreate.status).toHaveBeenCalledWith(400);

    mPrismaClient.doNotKnockRecord.create.mockResolvedValueOnce({ id: 'dnk-2', address: '99 Pine' });
    const okCreate = mockReply();
    await createDoNotKnock({ user: { tenantId: 't-1' }, body: { address: '99 Pine' } } as any, okCreate);
    expect(okCreate.status).toHaveBeenCalledWith(201);

    mPrismaClient.doNotKnockRecord.delete.mockResolvedValueOnce({});
    const delReply = mockReply();
    await deleteDoNotKnock({ params: { id: 'dnk-2' } } as any, delReply);
    expect(delReply.send).toHaveBeenCalledWith({ success: true, message: 'Do Not Knock restriction removed' });
  });
});
