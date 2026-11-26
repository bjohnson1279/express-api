const mockPrisma: any = {
  $queryRaw: jest.fn(),
  notificationQueue: { findMany: jest.fn(), update: jest.fn() },
  notificationPreference: { findUnique: jest.fn() },
  propertyPhoto: { create: jest.fn(), findMany: jest.fn() },
  erpSyncLog: { create: jest.fn() },
};

jest.mock('../src/shared/database', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

const mockTwilioMessagesCreate = jest.fn();
const mockTwilioCallsCreate = jest.fn();
jest.mock('twilio', () =>
  jest.fn(() => ({
    messages: { create: (...a: any[]) => mockTwilioMessagesCreate(...a) },
    calls: { create: (...a: any[]) => mockTwilioCallsCreate(...a) },
  }))
);

const mockSendMail = jest.fn();
jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(() => ({ sendMail: (...a: any[]) => mockSendMail(...a) })),
  },
}));

const mockSchedule = jest.fn();
jest.mock('../src/shared/scheduler', () => ({
  __esModule: true,
  default: { schedule: (...a: any[]) => mockSchedule(...a) },
}));

const mockSaveMultipart = jest.fn();
jest.mock('../src/shared/multipartUpload', () => ({
  saveMultipartUpload: (...a: any[]) => mockSaveMultipart(...a),
}));

import { Invoice } from '../src/domain/billing/entities/Invoice';
import { Quote } from '../src/domain/billing/entities/Quote';
import { Money } from '../src/domain/billing/valueObjects/Money';
import { Customer } from '../src/domain/crm/entities/Customer';
import { Property } from '../src/domain/crm/entities/Property';
import { Address } from '../src/domain/crm/valueObjects/Address';
import { CustomerHealthScoreCalculator } from '../src/domain/crm/services/CustomerHealthScoreCalculator';
import { PhoneNumber } from '../src/domain/crm/valueObjects/PhoneNumber';
import { AgreementSignature } from '../src/domain/sales/valueObjects/AgreementSignature';
import { TerritoryPolygon } from '../src/domain/sales/valueObjects/TerritoryPolygon';
import { GeoCoordinate } from '../src/domain/sales/valueObjects/GeoCoordinate';
import { jobCommand, jobCalendar } from '../src/domains/dispatch/jobService';
import { NotificationService } from '../src/domains/comms/NotificationService';
import { startNotificationCron } from '../src/domains/comms/NotificationCron';
import propertyRoutes from '../src/domains/crm/propertyRoutes';
import { QuickBooksClient, syncToErp } from '../src/domains/billing/erpIntegration';

function mockReply() {
  const r: any = {
    statusCode: 200,
    body: undefined,
    status(c: number) { this.statusCode = c; return this; },
    send(b: any) { this.body = b; return this; },
  };
  return r;
}

describe('Express Wave 26: domain entities, jobService, notifications, propertyRoutes, and ERP integration', () => {
  beforeEach(() => jest.clearAllMocks());

  it('covers remaining domain entity and value object branches', () => {
    const inv = new Invoice('inv-1' as any, 't1' as any, 'c1' as any, 'j1' as any, Money.fromDollars(100));
    expect(() => inv.applyPayment(Money.zero())).toThrow('greater than zero');
    inv.applyPayment(Money.fromDollars(100));
    expect(inv.domainEvents).toHaveLength(1);
    inv.clearDomainEvents();
    expect(inv.domainEvents).toHaveLength(0);

    expect(() => new Quote('q0' as any, 't1' as any, 'c1' as any, 'p1' as any, { amountInCents: -10 } as any)).toThrow('negative');
    const q = new Quote('q1' as any, 't1' as any, 'c1' as any, 'p1' as any, Money.fromDollars(50));
    q.accept();
    q.clearDomainEvents();
    expect(q.domainEvents).toHaveLength(0);
    expect(() => q.reject()).toThrow('already accepted');

    const cust = new Customer({ id: 'c1', tenantId: 't1', name: 'Alice' });
    cust.updateName('Alicia');
    expect(cust.name).toBe('Alicia');
    cust.addProperty(new Property('p1', 'c1', new Address('1 Main St', 'Austin', 'TX', '78701')));
    expect(cust.properties).toHaveLength(1);
    cust.clearDomainEvents();
    expect(cust.domainEvents).toHaveLength(0);

    const hs = CustomerHealthScoreCalculator.calculate({
      unpaidInvoicesCount: 0,
      hasActiveContract: true,
      hasRecentContact: false,
      monthsSinceLastJob: null,
    });
    expect(hs.score).toBe(90);

    expect(() => new PhoneNumber('')).toThrow('empty');
    expect(new PhoneNumber('555-123-4567').equals(new PhoneNumber('(555) 123-4567'))).toBe(true);

    expect(() => new AgreementSignature('')).toThrow('empty');
    const sig = new AgreementSignature('<svg/>', 'Bob', new Date('2026-01-01T00:00:00Z'));
    expect(sig.toJSON()).toMatchObject({ signatureSvg: '<svg/>', signerName: 'Bob' });

    const poly = new TerritoryPolygon([new GeoCoordinate(0, 0), [0, 1], { lat: 1, lng: 1 }]);
    expect(poly.coordinates).toHaveLength(3);
    expect(() => new TerritoryPolygon([new GeoCoordinate(0, 0), [0, 1], 'bad' as any])).toThrow('Malformed');
  });

  it('covers jobCommand error mapping and jobCalendar formatting', async () => {
    const actor = { id: 'u1', tenantId: 't1', role: 'ADMIN' };
    mockPrisma.$queryRaw.mockRejectedValueOnce({ meta: { code: 'P0404', message: 'ERROR: Missing' } });
    await expect(jobCommand(actor, 'get')).rejects.toMatchObject({ status: 404, message: 'Missing' });

    mockPrisma.$queryRaw.mockRejectedValueOnce({ meta: { code: '22P02' } });
    await expect(jobCommand(actor, 'get')).rejects.toMatchObject({ status: 400 });

    mockPrisma.$queryRaw.mockRejectedValueOnce(new Error('db'));
    await expect(jobCommand(actor, 'get')).rejects.toMatchObject({ status: 500 });

    const cal = jobCalendar([
      { id: 'j1', purpose: 'return_visit', status: 'in_progress', scheduled_start: '2026-05-01T10:00:00Z', customer: { name: 'Acme' }, property: { address: '1 Main' } },
      { id: 'j2', scheduled_start: null, customer: { name: 'X' }, property: { address: 'Y' } },
    ]);
    expect(cal).toHaveLength(1);
    expect(cal[0].title).toContain('Return visit: Acme');
    expect(cal[0].color).toBe('#f59e0b');
  });

  it('covers NotificationService error paths and NotificationCron channels/opt-outs/errors', async () => {
    const svc = new NotificationService();
    mockTwilioMessagesCreate.mockRejectedValueOnce(new Error('sms fail'));
    await expect(svc.sendSMS('+15551234567', 'hi')).rejects.toThrow('sms fail');

    mockTwilioCallsCreate.mockRejectedValueOnce(new Error('voice fail'));
    await expect(svc.sendRobocall('+15551234567', 'hi')).rejects.toThrow('voice fail');

    mockSendMail.mockRejectedValueOnce(new Error('mail fail'));
    await expect(svc.sendEmail('a@b.com', 'sub', 'txt')).rejects.toThrow('mail fail');

    startNotificationCron();
    const cronFn = mockSchedule.mock.calls[0][1];

    mockTwilioCallsCreate.mockResolvedValue({ sid: 'CA1' });
    mockSendMail.mockResolvedValue({ messageId: 'm1' });
    mockPrisma.notificationQueue.findMany.mockResolvedValueOnce([
      { id: 'n1', customerId: 'c1', channel: 'SMS', contactTarget: '+15550001111', messageContent: 'hi' },
      { id: 'n2', customerId: 'c2', channel: 'VOICE', contactTarget: '+15550002222', messageContent: 'call' },
      { id: 'n3', customerId: 'c3', channel: 'VOICE', contactTarget: '+15550003333', messageContent: 'call' },
      { id: 'n4', customerId: 'c4', channel: 'EMAIL', contactTarget: 'a@b.com', messageContent: 'mail' },
      { id: 'n5', customerId: 'c5', channel: 'EMAIL', contactTarget: 'b@b.com', messageContent: 'mail' },
      { id: 'n6', customerId: 'c6', channel: 'SMS', contactTarget: '+15550006666', messageContent: 'fail' },
    ]);
    mockPrisma.notificationPreference.findUnique
      .mockResolvedValueOnce({ smsEnabled: false, emailEnabled: true, voiceEnabled: false })
      .mockResolvedValueOnce({ smsEnabled: true, emailEnabled: true, voiceEnabled: true })
      .mockResolvedValueOnce({ smsEnabled: true, emailEnabled: true, voiceEnabled: false })
      .mockResolvedValueOnce({ smsEnabled: true, emailEnabled: true, voiceEnabled: false })
      .mockResolvedValueOnce({ smsEnabled: true, emailEnabled: false, voiceEnabled: false })
      .mockRejectedValueOnce(new Error('pref err'));

    await cronFn();
    expect(mockPrisma.notificationQueue.update).toHaveBeenCalled();

    mockPrisma.notificationQueue.findMany.mockRejectedValueOnce(new Error('cron db err'));
    await cronFn();
  });

  it('covers propertyRoutes error paths and erpIntegration non-mock/unsupported provider', async () => {
    const handlers: Record<string, any> = {};
    const fakeFastify: any = {
      post: jest.fn((p: string, h: any) => { handlers[`POST ${p}`] = h; }),
      get: jest.fn((p: string, h: any) => { handlers[`GET ${p}`] = h; }),
    };
    await propertyRoutes(fakeFastify, {} as any);

    mockSaveMultipart.mockRejectedValueOnce(Object.assign(new Error('Too big'), { statusCode: 413 }));
    const r1 = mockReply();
    await handlers['POST /:id/photos']({ params: { id: 'p1' } }, r1);
    expect(r1.statusCode).toBe(413);

    mockSaveMultipart.mockRejectedValueOnce(new Error('disk err'));
    const r2 = mockReply();
    await handlers['POST /:id/photos']({ params: { id: 'p1' } }, r2);
    expect(r2.statusCode).toBe(500);

    mockPrisma.propertyPhoto.findMany.mockRejectedValueOnce(new Error('db err'));
    const r3 = mockReply();
    await handlers['GET /:id/photos']({ params: { id: 'p1' } }, r3);
    expect(r3.statusCode).toBe(500);

    const qb = new QuickBooksClient({ accessToken: 'live-token' });
    const res = await qb.syncJournal('inv-1', 'INVOICE', { amount: 100 });
    expect(res.transactionId).toContain('qbo-journal-');

    mockPrisma.erpSyncLog.create.mockResolvedValueOnce({ status: 'failure' });
    const log = await syncToErp('netsuite' as any, 'inv-1', 'INVOICE', {});
    expect(log.status).toBe('failure');
  });
});
