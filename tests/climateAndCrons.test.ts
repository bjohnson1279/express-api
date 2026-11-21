const scheduledTasks: Array<{ expr: string; fn: () => Promise<void> }> = [];
jest.mock('../src/shared/scheduler', () => ({
  __esModule: true,
  default: {
    schedule: jest.fn((expr: string, fn: () => Promise<void>) => {
      scheduledTasks.push({ expr, fn });
    }),
  },
}));

const mPrismaClient = {
  notificationQueue: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  notificationPreference: {
    findUnique: jest.fn(),
  },
  inventoryItem: {
    findMany: jest.fn(),
  },
  purchaseOrder: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
  automatedFollowup: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  customerEmail: {
    findFirst: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mPrismaClient),
}));

const mockSendSMS = jest.fn();
const mockSendEmail = jest.fn();
const mockSendRobocall = jest.fn();
jest.mock('../src/domains/comms/NotificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    sendSMS: (...args: any[]) => mockSendSMS(...args),
    sendEmail: (...args: any[]) => mockSendEmail(...args),
    sendRobocall: (...args: any[]) => mockSendRobocall(...args),
  })),
}));

import { ClimateService } from '../src/domains/analytics/ClimateService';
import { startNotificationCron } from '../src/domains/comms/NotificationCron';
import { startInventoryCron } from '../src/domains/dispatch/InventoryCron';
import { startFollowUpCron } from '../src/domains/sales/FollowUpCron';

describe('ClimateService & Background Cron Workers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    scheduledTasks.length = 0;
  });

  it('ClimateService translates WMO weather codes and evaluates pest impact across conditions', () => {
    expect(ClimateService.getWeatherDescription(0)).toBe('Clear Sky');
    expect(ClimateService.getWeatherDescription(45)).toBe('Fog / Deposition Fog');
    expect(ClimateService.getWeatherDescription(61)).toBe('Rain (Sustained)');
    expect(ClimateService.getWeatherDescription(95)).toBe('Thunderstorm');
    expect(ClimateService.getWeatherDescription(999)).toBe('Ambient Weather');

    const hotImpact = ClimateService.evaluatePestImpact(92, 80, 0.5, 20);
    expect(hotImpact).toContain('Excessive heat');
    expect(hotImpact).toContain('High relative humidity');
    expect(hotImpact).toContain('Recent precipitation');
    expect(hotImpact).toContain('High winds');

    const coldImpact = ClimateService.evaluatePestImpact(40, 30, 0, 5);
    expect(coldImpact).toContain('Low ambient temperature');
    expect(coldImpact).toContain('Low humidity');

    const fallback = ClimateService.getFallbackClimate(34.05, -118.24);
    expect(fallback.source).toBe('offline-ambient-fallback');
    expect(fallback.cached).toBe(false);
  });

  it('NotificationCron dispatches opted-in SMS and skips opted-out EMAIL', async () => {
    startNotificationCron();
    expect(scheduledTasks).toHaveLength(1);

    mPrismaClient.notificationQueue.findMany.mockResolvedValueOnce([
      { id: 'n-1', customerId: 'c-1', channel: 'SMS', contactTarget: '+15550101', messageContent: 'On the way' },
      { id: 'n-2', customerId: 'c-2', channel: 'EMAIL', contactTarget: 'no@example.com', messageContent: 'Receipt' },
    ]);
    mPrismaClient.notificationPreference.findUnique
      .mockResolvedValueOnce({ smsEnabled: true, emailEnabled: true, voiceEnabled: false })
      .mockResolvedValueOnce({ smsEnabled: true, emailEnabled: false, voiceEnabled: false });
    mockSendSMS.mockResolvedValueOnce({ success: true });

    await scheduledTasks[0].fn();

    expect(mockSendSMS).toHaveBeenCalledWith('+15550101', 'On the way');
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mPrismaClient.notificationQueue.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'n-1' }, data: expect.objectContaining({ status: 'completed' }) })
    );
    expect(mPrismaClient.notificationQueue.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'n-2' }, data: expect.objectContaining({ status: 'skipped' }) })
    );
  });

  it('InventoryCron drafts purchase orders for low-stock items and notifies admins', async () => {
    startInventoryCron();
    expect(scheduledTasks).toHaveLength(1);

    mPrismaClient.inventoryItem.findMany.mockResolvedValueOnce([
      { id: 'i-1', tenantId: 't-1', name: 'Termidor', sku: 'TRM-1', quantity: 3, minimumThreshold: 10 },
      { id: 'i-2', tenantId: 't-1', name: 'Gloves', sku: 'GLV-1', quantity: 50, minimumThreshold: 10 },
    ]);
    mPrismaClient.purchaseOrder.findFirst.mockResolvedValueOnce(null);
    mPrismaClient.purchaseOrder.create.mockResolvedValueOnce({ id: 'po-1' });
    mPrismaClient.user.findMany.mockResolvedValueOnce([{ id: 'admin-1', email: 'admin@example.com' }]);
    mockSendEmail.mockResolvedValueOnce({ success: true });

    await scheduledTasks[0].fn();

    expect(mPrismaClient.purchaseOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ itemId: 'i-1', quantity: 20, status: 'draft' }) })
    );
    expect(mockSendEmail).toHaveBeenCalledWith('admin@example.com', 'Low Stock Alert: Termidor', expect.any(String));
  });

  it('FollowUpCron sends emails to primary customer email and marks missing email as failed', async () => {
    startFollowUpCron();
    expect(scheduledTasks).toHaveLength(1);

    mPrismaClient.automatedFollowup.findMany.mockResolvedValueOnce([
      { id: 'f-1', customerId: 'c-1', customer: { name: 'Alice' }, campaign: { name: 'Spring Check' } },
      { id: 'f-2', customerId: 'c-2', customer: { name: 'Bob' }, campaign: null },
    ]);
    mPrismaClient.customerEmail.findFirst
      .mockResolvedValueOnce({ emailAddress: 'alice@example.com' })
      .mockResolvedValueOnce(null);
    mockSendEmail.mockResolvedValueOnce({ success: true });

    await scheduledTasks[0].fn();

    expect(mPrismaClient.automatedFollowup.update).toHaveBeenCalledWith({
      where: { id: 'f-1' },
      data: { sentStatus: 'sent' },
    });
    expect(mPrismaClient.automatedFollowup.update).toHaveBeenCalledWith({
      where: { id: 'f-2' },
      data: { sentStatus: 'failed' },
    });
  });
});
