import fs from 'fs';

const mockPrisma: any = {
  property: { findFirst: jest.fn(), findUnique: jest.fn() },
  propertyPestRiskScore: { create: jest.fn() },
  customerPhone: { findFirst: jest.fn() },
  customer: { findUnique: jest.fn(), findMany: jest.fn() },
  invoice: { count: jest.fn() },
  serviceContract: { count: jest.fn() },
  job: { findFirst: jest.fn(), findMany: jest.fn() },
  inventoryItem: { findMany: jest.fn() },
  $transaction: jest.fn(),
};

jest.mock('../src/shared/database', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
  inWorkerContext: (fn: any) => fn(),
}));

jest.mock('../src/domains/analytics/ClimateService', () => ({
  ClimateService: {
    getClimateData: jest.fn().mockResolvedValue({
      temperature: 75,
      relativeHumidity: 55,
      precipitation: 0,
      windSpeed: 5,
      conditionSummary: 'Clear',
      source: 'mock',
    }),
  },
}));

const mockConstructEvent = jest.fn();
jest.mock('../src/domains/billing/stripeService', () => ({
  stripeService: { constructEvent: (...a: any[]) => mockConstructEvent(...a) },
}));

const mockSignAgreement = jest.fn();
jest.mock('../src/domains/sales/AgreementService', () => ({
  AgreementService: jest.fn().mockImplementation(() => ({
    generateAgreement: jest.fn(),
    signAgreement: (...a: any[]) => mockSignAgreement(...a),
  })),
}));

const mockCronSchedule = jest.fn();
jest.mock('node-cron', () => ({
  __esModule: true,
  default: { schedule: (...a: any[]) => mockCronSchedule(...a) },
  schedule: (...a: any[]) => mockCronSchedule(...a),
}));

import { PestRiskService } from '../src/domains/analytics/pestRiskService';
import { stripeWebhook } from '../src/domains/billing/webhookController';
import { getAvailableSlots } from '../src/domains/dispatch/bookingController';
import { TwilioWebhookController } from '../src/domains/comms/TwilioWebhookController';
import { HealthScoreService } from '../src/domains/crm/HealthScoreService';
import { signAgreement, downloadAgreement } from '../src/domains/sales/AgreementController';
import { startPreVisitNotificationCron } from '../src/domains/comms/PreVisitNotificationCron';
import { startHealthScoreCron } from '../src/domains/crm/HealthScoreCron';
import { startInventoryCron } from '../src/domains/dispatch/InventoryCron';
import scheduler from '../src/shared/scheduler';

function mockReply() {
  const r: any = {
    statusCode: 200,
    body: undefined,
    status(c: number) { this.statusCode = c; return this; },
    type() { return this; },
    send(b: any) { this.body = b; return this; },
  };
  return r;
}

describe('Express Wave 28: final stretch to 99.5%+', () => {
  beforeEach(() => jest.clearAllMocks());

  it('covers PestRiskService missing property, log sorting, 35d/60d decay, and rodent/wasp pests', async () => {
    mockPrisma.property.findFirst.mockResolvedValueOnce(null);
    await expect(PestRiskService.calculatePropertyRisk('missing', 't1')).rejects.toThrow('not found');

    const d35 = new Date(Date.now() - 35 * 86400000);
    const d40 = new Date(Date.now() - 40 * 86400000);
    mockPrisma.property.findFirst.mockResolvedValueOnce({
      id: 'p1',
      address: '1 Main',
      lat: 39.7,
      lng: -89.6,
      photos: [],
      jobs: [{ chemicalLogs: [{ appliedAt: d40, targetPests: ['Ants'] }, { appliedAt: d35, targetPests: ['Rodent'] }] }],
    });
    mockPrisma.propertyPestRiskScore.create.mockResolvedValueOnce({ id: 's1' });
    const r1 = await PestRiskService.calculatePropertyRisk('p1', 't1');
    expect(r1.primaryTargetPest).toBe('Rodents (Mice/Rats)');

    const d60 = new Date(Date.now() - 60 * 86400000);
    mockPrisma.property.findFirst.mockResolvedValueOnce({
      id: 'p2',
      address: '2 Main',
      lat: 39.7,
      lng: -89.6,
      photos: [],
      jobs: [{ chemicalLogs: [{ appliedAt: d60, targetPests: ['Wasp'] }] }],
    });
    mockPrisma.propertyPestRiskScore.create.mockResolvedValueOnce({ id: 's2' });
    const r2 = await PestRiskService.calculatePropertyRisk('p2', 't1');
    expect(r2.primaryTargetPest).toBe('Paper Wasps');
  });

  it('covers stripeWebhook payment_failed, bookingController catch, Twilio catch, AgreementController catches, and HealthScore 6-12mo', async () => {
    mockConstructEvent.mockReturnValueOnce({ type: 'payment_intent.payment_failed', data: { object: { id: 'pi_1' } } });
    const r1 = mockReply();
    stripeWebhook({ headers: { 'stripe-signature': 'sig' }, body: '{}' } as any, r1);
    expect(r1.body).toEqual({ received: true });

    const r2: any = {
      statusCode: 200,
      status(c: number) { this.statusCode = c; return this; },
      send: jest.fn().mockImplementationOnce(() => { throw new Error('send fail'); }).mockImplementationOnce(() => {}),
    };
    await getAvailableSlots({ query: { date: '2026-06-01' } } as any, r2);
    expect(r2.statusCode).toBe(500);

    mockPrisma.customerPhone.findFirst.mockRejectedValueOnce(new Error('db'));
    const r3 = mockReply();
    await TwilioWebhookController.handleInboundSms({ body: { From: '+1555', Body: 'hi', To: '+1666' }, user: { tenantId: 't1' } } as any, r3);
    expect(r3.statusCode).toBe(500);

    mockSignAgreement.mockRejectedValueOnce(new Error('sign fail'));
    const r4 = mockReply();
    await signAgreement({ params: { id: 'a1' }, body: { signatureSvg: '<svg/>' } } as any, r4);
    expect(r4.statusCode).toBe(500);

    const existsSpy = jest.spyOn(fs, 'existsSync').mockImplementationOnce(() => { throw new Error('fs fail'); });
    const r5 = mockReply();
    await downloadAgreement({ params: { id: '11111111-1111-1111-1111-111111111111' } } as any, r5);
    expect(r5.statusCode).toBe(500);
    existsSpy.mockRestore();

    mockPrisma.customer.findUnique.mockResolvedValueOnce({ id: 'c1' });
    mockPrisma.invoice.count.mockResolvedValueOnce(0);
    mockPrisma.serviceContract.count.mockResolvedValueOnce(1);
    mockPrisma.job.findFirst.mockResolvedValueOnce({ scheduledStart: new Date(Date.now() - 270 * 86400000) });
    mockPrisma.$transaction.mockImplementationOnce(async (cb: any) =>
      cb({
        $queryRaw: jest.fn(),
        customerHealthScore: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockImplementation(({ data }: any) => data),
        },
      })
    );
    const hs = await new HealthScoreService().calculateForCustomer('c1');
    expect(hs.score).toBe(85);
  });

  it('covers scheduler wrapper and cron outer error catches', async () => {
    const task = scheduler.schedule('* * * * *', () => {});
    expect(mockCronSchedule).toHaveBeenCalled();
    expect(task).toBeUndefined();

    startPreVisitNotificationCron();
    const preVisitFn = mockCronSchedule.mock.calls[mockCronSchedule.mock.calls.length - 1][1];
    mockPrisma.job.findMany.mockRejectedValueOnce(new Error('db'));
    await preVisitFn();

    startInventoryCron();
    const invFn = mockCronSchedule.mock.calls[mockCronSchedule.mock.calls.length - 1][1];
    mockPrisma.inventoryItem.findMany.mockRejectedValueOnce(new Error('db'));
    await invFn();

    startHealthScoreCron();
    const hsFn = mockCronSchedule.mock.calls[mockCronSchedule.mock.calls.length - 1][1];
    mockPrisma.customer.findMany.mockRejectedValueOnce(new Error('db'));
    await hsFn();
  });
});
