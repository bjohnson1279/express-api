const mockPrisma: any = {
  job: { findMany: jest.fn() },
  invoice: { findMany: jest.fn() },
  chemicalApplicationLog: { findMany: jest.fn(), create: jest.fn() },
  chatConversation: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  chatMessage: { count: jest.fn(), updateMany: jest.fn(), create: jest.fn() },
  customer: { findFirst: jest.fn() },
  contactLog: { create: jest.fn() },
  user: { findFirst: jest.fn() },
  cannedResponse: { findMany: jest.fn(), create: jest.fn() },
  inventoryItem: { findMany: jest.fn(), create: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
  purchaseOrder: { findMany: jest.fn(), create: jest.fn() },
};

jest.mock('../src/shared/database', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));

const mockDashboardSummary = jest.fn();
jest.mock('../src/domains/analytics/dashboardService', () => ({
  dashboardSummary: (...args: any[]) => mockDashboardSummary(...args),
}));

const mockCalcRisk = jest.fn();
const mockGetHeatmap = jest.fn();
jest.mock('../src/domains/analytics/pestRiskService', () => ({
  PestRiskService: {
    calculatePropertyRisk: (...args: any[]) => mockCalcRisk(...args),
    getHeatmapData: (...args: any[]) => mockGetHeatmap(...args),
  },
}));

const mockGetClimate = jest.fn();
jest.mock('../src/domains/analytics/ClimateService', () => ({
  ClimateService: {
    getClimateData: (...args: any[]) => mockGetClimate(...args),
  },
}));

const mockBroadcast = jest.fn();
jest.mock('../src/domains/comms/eventBus', () => ({
  eventBus: { broadcast: (...args: any[]) => mockBroadcast(...args) },
}));

jest.mock('pdfkit', () =>
  jest.fn().mockImplementation(() => ({
    fontSize: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    moveDown: jest.fn().mockReturnThis(),
    end: jest.fn(),
  }))
);

import {
  getDashboardAnalytics,
  getClimateMetrics,
  getPropertyPestRisk,
  getPestRiskHeatmap,
  recalculatePestRisks,
  getLaborCosts,
  exportReport,
} from '../src/domains/analytics/analyticsController';
import { ChatController } from '../src/domains/comms/chatController';
import {
  getInventoryItems,
  createInventoryItem,
  updateInventoryQuantity,
  getPurchaseOrders,
  createPurchaseOrder,
} from '../src/domains/dispatch/inventoryController';

function mockReply() {
  const r: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined,
    status(c: number) { this.statusCode = c; return this; },
    code(c: number) { this.statusCode = c; return this; },
    header(k: string, v: string) { this.headers[k] = v; return this; },
    send(b: any) { this.body = b; return this; },
  };
  return r;
}

describe('Express API: analyticsController, chatController, and inventoryController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyticsController', () => {
    it('covers dashboard, climate, pest risk, heatmap, recalculate, and labor costs', async () => {
      mockDashboardSummary.mockResolvedValueOnce({ activeJobs: 5 });
      const r1 = mockReply();
      await getDashboardAnalytics({ headers: { authorization: 'Bearer tok' } } as any, r1);
      expect(r1.body).toEqual({ activeJobs: 5 });

      mockDashboardSummary.mockRejectedValueOnce(Object.assign(new Error('Unauthorized'), { status: 401 }));
      const r1e = mockReply();
      await getDashboardAnalytics({ headers: {} } as any, r1e);
      expect(r1e.statusCode).toBe(401);

      mockGetClimate.mockResolvedValueOnce({ temperature: 72 });
      const r2 = mockReply();
      await getClimateMetrics({ query: { lat: '40.1', lng: '-105.2' } } as any, r2);
      expect(r2.body).toEqual({ temperature: 72 });

      mockCalcRisk.mockResolvedValueOnce({ score: 80 });
      const r3 = mockReply();
      await getPropertyPestRisk({ params: { propertyId: 'p1' }, headers: {} } as any, r3);
      expect(r3.body).toEqual({ score: 80 });

      mockGetHeatmap.mockResolvedValueOnce([{ propertyId: 'p1', score: 80 }]);
      const r4 = mockReply();
      await getPestRiskHeatmap({ headers: {} } as any, r4);
      expect(r4.body).toHaveLength(1);

      mockGetHeatmap.mockResolvedValueOnce([{ propertyId: 'p1' }]);
      const r5 = mockReply();
      await recalculatePestRisks({ headers: {} } as any, r5);
      expect(r5.body).toMatchObject({ success: true, count: 1 });

      mockPrisma.job.findMany.mockResolvedValueOnce([
        { technician: { id: 'tech-1', user: { email: 't@test.com' } }, onSiteTimeMinutes: 45, driveTimeMinutes: 15 },
        { technician: { id: 'tech-1', user: { email: 't@test.com' } }, onSiteTimeMinutes: 30, driveTimeMinutes: 10 },
      ]);
      const r6 = mockReply();
      await getLaborCosts({} as any, r6);
      expect(r6.body).toEqual([{ technician: 't@test.com', totalOnSiteMinutes: 75, totalDriveMinutes: 25, jobsCount: 2 }]);
    });

    it('covers exportReport for productivity, revenue, chemicals, csv, pdf, empty fallback, and invalid params', async () => {
      mockPrisma.job.findMany.mockResolvedValueOnce([
        { status: 'completed', onSiteTimeMinutes: 60, technician: { user: { email: 't@test.com' } } },
      ]);
      const rProd = mockReply();
      await exportReport({ query: { type: 'productivity', format: 'csv' } } as any, rProd);
      expect(rProd.headers['Content-Type']).toBe('text/csv');
      expect(rProd.body).toContain('t@test.com');

      mockPrisma.invoice.findMany.mockResolvedValueOnce([
        { id: 'inv-1', status: 'paid', totalAmount: 199, job: { customer: { name: 'Acme' } } },
      ]);
      const rRev = mockReply();
      await exportReport({ query: { type: 'revenue', format: 'pdf' } } as any, rRev);
      expect(rRev.headers['Content-Type']).toBe('application/pdf');

      mockPrisma.chemicalApplicationLog.findMany.mockResolvedValueOnce([]);
      const rChem = mockReply();
      await exportReport({ query: { type: 'chemicals', format: 'csv' } } as any, rChem);
      expect(rChem.body).toContain('No data available');

      const rBadType = mockReply();
      await exportReport({ query: { type: 'unknown', format: 'csv' } } as any, rBadType);
      expect(rBadType.statusCode).toBe(400);

      mockPrisma.invoice.findMany.mockResolvedValueOnce([]);
      const rBadFmt = mockReply();
      await exportReport({ query: { type: 'revenue', format: 'xlsx' } } as any, rBadFmt);
      expect(rBadFmt.statusCode).toBe(400);

      // Error branches across analyticsController
      mockGetClimate.mockRejectedValueOnce(new Error('climate err'));
      const ae1 = mockReply(); await getClimateMetrics({ query: {} } as any, ae1); expect(ae1.statusCode).toBe(500);

      mockCalcRisk.mockRejectedValueOnce(new Error('risk err'));
      const ae2 = mockReply(); await getPropertyPestRisk({ params: { propertyId: 'p1' }, headers: {} } as any, ae2); expect(ae2.statusCode).toBe(500);

      mockGetHeatmap.mockRejectedValueOnce(new Error('heat err'));
      const ae3 = mockReply(); await getPestRiskHeatmap({ headers: {} } as any, ae3); expect(ae3.statusCode).toBe(500);

      mockGetHeatmap.mockRejectedValueOnce(new Error('recalc err'));
      const ae4 = mockReply(); await recalculatePestRisks({ headers: {} } as any, ae4); expect(ae4.statusCode).toBe(500);

      mockPrisma.job.findMany.mockRejectedValueOnce(new Error('labor err'));
      const ae5 = mockReply(); await getLaborCosts({} as any, ae5); expect(ae5.statusCode).toBe(500);

      mockPrisma.invoice.findMany.mockRejectedValueOnce(new Error('export err'));
      const ae6 = mockReply(); await exportReport({ query: { type: 'revenue', format: 'csv' } } as any, ae6); expect(ae6.statusCode).toBe(500);
    });
  });

  describe('ChatController', () => {
    it('covers getConversations, getConversation, createConversation, sendMessage, updateConversation, and canned responses', async () => {
      mockPrisma.chatConversation.findMany.mockResolvedValueOnce([{ id: 'conv-1', messages: [{ id: 'm1' }] }]);
      mockPrisma.chatMessage.count.mockResolvedValueOnce(2);
      const rList = mockReply();
      await ChatController.getConversations({ query: { status: 'OPEN', customerId: 'c1', assignedCsrId: 'u1' }, user: { tenantId: 't1' } } as any, rList);
      expect(rList.body[0].unreadCount).toBe(2);

      mockPrisma.chatConversation.findFirst.mockResolvedValueOnce(null);
      const r404 = mockReply();
      await ChatController.getConversation({ params: { id: 'missing' }, user: { tenantId: 't1' } } as any, r404);
      expect(r404.statusCode).toBe(404);

      mockPrisma.chatConversation.findFirst.mockResolvedValueOnce({ id: 'conv-1', messages: [] });
      mockPrisma.chatMessage.updateMany.mockResolvedValueOnce({ count: 1 });
      const rGet = mockReply();
      await ChatController.getConversation({ params: { id: 'conv-1' }, user: { tenantId: 't1' } } as any, rGet);
      expect(rGet.body.id).toBe('conv-1');

      const rBadCreate = mockReply();
      await ChatController.createConversation({ body: {}, user: { tenantId: 't1' } } as any, rBadCreate);
      expect(rBadCreate.statusCode).toBe(400);

      mockPrisma.customer.findFirst.mockResolvedValueOnce({ id: 'c1' });
      mockPrisma.chatConversation.create.mockResolvedValueOnce({ id: 'conv-2', customer: { name: 'Alice' } });
      mockPrisma.chatMessage.create.mockResolvedValueOnce({ id: 'm-init', messageText: 'Hi' });
      mockPrisma.contactLog.create.mockResolvedValueOnce({});
      const rCreate = mockReply();
      await ChatController.createConversation({ body: { customerId: 'c1', initialMessage: 'Hi' }, user: { tenantId: 't1' } } as any, rCreate);
      expect(rCreate.statusCode).toBe(201);
      expect(mockBroadcast).toHaveBeenCalledWith('conversation_created', expect.anything(), 't1');

      const rEmptyMsg = mockReply();
      await ChatController.sendMessage({ params: { id: 'conv-2' }, body: { messageText: '  ' }, user: { tenantId: 't1', id: 'u1' } } as any, rEmptyMsg);
      expect(rEmptyMsg.statusCode).toBe(400);

      mockPrisma.chatConversation.findFirst.mockResolvedValueOnce({ id: 'conv-2', customerId: 'c1', status: 'RESOLVED', assignedCsrId: null, customer: { name: 'Alice' } });
      mockPrisma.chatMessage.create.mockResolvedValueOnce({ id: 'm2', messageText: 'Hello' });
      mockPrisma.chatConversation.update.mockResolvedValueOnce({});
      mockPrisma.contactLog.create.mockResolvedValueOnce({});
      const rSend = mockReply();
      await ChatController.sendMessage({ params: { id: 'conv-2' }, body: { senderType: 'CSR', senderId: 'u1', messageText: 'Hello' }, user: { tenantId: 't1', id: 'u1' } } as any, rSend);
      expect(rSend.statusCode).toBe(201);

      mockPrisma.user.findFirst.mockResolvedValueOnce(null);
      const rBadAssignee = mockReply();
      await ChatController.updateConversation({ params: { id: 'conv-2' }, body: { assignedCsrId: 'bad' }, user: { tenantId: 't1' } } as any, rBadAssignee);
      expect(rBadAssignee.statusCode).toBe(404);

      mockPrisma.user.findFirst.mockResolvedValueOnce({ id: 'u2' });
      mockPrisma.chatConversation.update.mockResolvedValueOnce({ id: 'conv-2', status: 'RESOLVED' });
      const rUpd = mockReply();
      await ChatController.updateConversation({ params: { id: 'conv-2' }, body: { status: 'RESOLVED', assignedCsrId: 'u2', subject: 'Done' }, user: { tenantId: 't1' } } as any, rUpd);
      expect(rUpd.body.status).toBe('RESOLVED');

      mockPrisma.cannedResponse.findMany.mockResolvedValueOnce([{ id: 'cr1', shortcut: '/hi' }]);
      const rCanned = mockReply();
      await ChatController.getCannedResponses({ user: { tenantId: 't1' } } as any, rCanned);
      expect(rCanned.body).toHaveLength(1);

      const rCanned400 = mockReply();
      await ChatController.createCannedResponse({ body: { shortcut: 'hi' }, user: { tenantId: 't1' } } as any, rCanned400);
      expect(rCanned400.statusCode).toBe(400);

      mockPrisma.cannedResponse.create.mockResolvedValueOnce({ id: 'cr2', shortcut: '/thanks' });
      const rCanned201 = mockReply();
      await ChatController.createCannedResponse({ body: { shortcut: 'thanks', title: 'Thanks', content: 'Thank you!' }, user: { tenantId: 't1' } } as any, rCanned201);
      expect(rCanned201.statusCode).toBe(201);

      // Error branches across ChatController
      mockPrisma.chatConversation.findMany.mockRejectedValueOnce(new Error('db'));
      const ce1 = mockReply(); await ChatController.getConversations({ query: {}, user: { tenantId: 't1' } } as any, ce1); expect(ce1.statusCode).toBe(500);

      mockPrisma.chatConversation.findFirst.mockRejectedValueOnce(new Error('db'));
      const ce2 = mockReply(); await ChatController.getConversation({ params: { id: 'c1' }, user: { tenantId: 't1' } } as any, ce2); expect(ce2.statusCode).toBe(500);

      mockPrisma.customer.findFirst.mockRejectedValueOnce(new Error('db'));
      const ce3 = mockReply(); await ChatController.createConversation({ body: { customerId: 'c1' }, user: { tenantId: 't1' } } as any, ce3); expect(ce3.statusCode).toBe(500);

      mockPrisma.chatConversation.findFirst.mockRejectedValueOnce(new Error('db'));
      const ce4 = mockReply(); await ChatController.sendMessage({ params: { id: 'c1' }, body: { messageText: 'hi' }, user: { tenantId: 't1', id: 'u1' } } as any, ce4); expect(ce4.statusCode).toBe(500);

      mockPrisma.chatConversation.update.mockRejectedValueOnce(new Error('db'));
      const ce5 = mockReply(); await ChatController.updateConversation({ params: { id: 'c1' }, body: { status: 'OPEN' }, user: { tenantId: 't1' } } as any, ce5); expect(ce5.statusCode).toBe(500);

      mockPrisma.cannedResponse.findMany.mockRejectedValueOnce(new Error('db'));
      const ce6 = mockReply(); await ChatController.getCannedResponses({ user: { tenantId: 't1' } } as any, ce6); expect(ce6.statusCode).toBe(500);

      mockPrisma.cannedResponse.create.mockRejectedValueOnce(new Error('db'));
      const ce7 = mockReply(); await ChatController.createCannedResponse({ body: { shortcut: 'a', title: 'b', content: 'c' }, user: { tenantId: 't1' } } as any, ce7); expect(ce7.statusCode).toBe(500);
    });
  });

  describe('inventoryController CRUD & POs', () => {
    it('covers getInventoryItems, createInventoryItem, updateInventoryQuantity, getPurchaseOrders, and createPurchaseOrder', async () => {
      mockPrisma.inventoryItem.findMany.mockResolvedValueOnce([{ id: 'i1' }]);
      const r1 = mockReply();
      await getInventoryItems({ user: { tenantId: 't1' } } as any, r1);
      expect(r1.body).toEqual([{ id: 'i1' }]);

      mockPrisma.inventoryItem.create.mockResolvedValueOnce({ id: 'i2', name: 'Bait' });
      const r2 = mockReply();
      await createInventoryItem({ user: { tenantId: 't1' }, body: { name: 'Bait', sku: 'B1', quantity: '10', minimumThreshold: '5', unitCost: '12.50', location: 'Bay 1' } } as any, r2);
      expect(r2.statusCode).toBe(201);

      mockPrisma.inventoryItem.update.mockResolvedValueOnce({ id: 'i2', quantity: 15 });
      const r3 = mockReply();
      await updateInventoryQuantity({ params: { id: 'i2' }, body: { quantityDelta: '5' } } as any, r3);
      expect(r3.body.quantity).toBe(15);

      mockPrisma.purchaseOrder.findMany.mockResolvedValueOnce([{ id: 'po1' }]);
      const r4 = mockReply();
      await getPurchaseOrders({ user: { tenantId: 't1' } } as any, r4);
      expect(r4.body).toEqual([{ id: 'po1' }]);

      mockPrisma.purchaseOrder.create.mockResolvedValueOnce({ id: 'po2' });
      const r5 = mockReply();
      await createPurchaseOrder({ user: { tenantId: 't1' }, body: { itemId: 'i2', quantity: '20', expectedDeliveryDate: '2026-12-01' } } as any, r5);
      expect(r5.statusCode).toBe(201);

      // Error branches across inventoryController
      mockPrisma.inventoryItem.findMany.mockRejectedValueOnce(new Error('db'));
      const ie1 = mockReply(); await getInventoryItems({ user: { tenantId: 't1' } } as any, ie1); expect(ie1.statusCode).toBe(500);

      mockPrisma.inventoryItem.create.mockRejectedValueOnce(new Error('db'));
      const ie2 = mockReply(); await createInventoryItem({ user: { tenantId: 't1' }, body: { name: 'X' } } as any, ie2); expect(ie2.statusCode).toBe(500);

      mockPrisma.inventoryItem.update.mockRejectedValueOnce(new Error('db'));
      const ie3 = mockReply(); await updateInventoryQuantity({ params: { id: 'i2' }, body: { quantityDelta: '5' } } as any, ie3); expect(ie3.statusCode).toBe(500);

      mockPrisma.purchaseOrder.findMany.mockRejectedValueOnce(new Error('db'));
      const ie4 = mockReply(); await getPurchaseOrders({ user: { tenantId: 't1' } } as any, ie4); expect(ie4.statusCode).toBe(500);

      mockPrisma.purchaseOrder.create.mockRejectedValueOnce(new Error('db'));
      const ie5 = mockReply(); await createPurchaseOrder({ user: { tenantId: 't1' }, body: { itemId: 'i2', quantity: '1' } } as any, ie5); expect(ie5.statusCode).toBe(500);
    });
  });
});
