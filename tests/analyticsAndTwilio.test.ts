const mPrismaClient = {
  job: {
    findMany: jest.fn(),
  },
  invoice: {
    findMany: jest.fn(),
  },
  chemicalApplicationLog: {
    findMany: jest.fn(),
  },
  customerPhone: {
    findFirst: jest.fn(),
  },
  contactLog: {
    create: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mPrismaClient),
}));

import { getLaborCosts, exportReport } from '../src/domains/analytics/analyticsController';
import { TwilioWebhookController } from '../src/domains/comms/TwilioWebhookController';

function mockReply() {
  const res: any = {
    status: jest.fn(),
    send: jest.fn(),
    header: jest.fn(),
    type: jest.fn(),
  };
  res.status.mockReturnValue(res);
  res.header.mockReturnValue(res);
  res.type.mockReturnValue(res);
  return res;
}

describe('Analytics & Twilio Controllers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getLaborCosts aggregates on-site and drive minutes by technician', async () => {
    mPrismaClient.job.findMany.mockResolvedValueOnce([
      { onSiteTimeMinutes: 40, driveTimeMinutes: 15, technician: { id: 't1', user: { email: 'sam@example.com' } } },
      { onSiteTimeMinutes: 50, driveTimeMinutes: 20, technician: { id: 't1', user: { email: 'sam@example.com' } } },
    ]);
    const reply = mockReply();
    await getLaborCosts({} as any, reply);
    expect(reply.send).toHaveBeenCalledWith([
      { technician: 'sam@example.com', totalOnSiteMinutes: 90, totalDriveMinutes: 35, jobsCount: 2 },
    ]);
  });

  it('exportReport validates report type and format and returns CSV for revenue', async () => {
    const badType = mockReply();
    await exportReport({ query: { format: 'csv', type: 'invalid' } } as any, badType);
    expect(badType.status).toHaveBeenCalledWith(400);

    mPrismaClient.invoice.findMany.mockResolvedValueOnce([
      { id: 'inv-1', status: 'paid', totalAmount: 199, job: { customer: { name: 'Acme' } } },
    ]);
    const okCsv = mockReply();
    await exportReport({ query: { format: 'csv', type: 'revenue' } } as any, okCsv);
    expect(okCsv.header).toHaveBeenCalledWith('Content-Type', 'text/csv');
    expect(okCsv.send).toHaveBeenCalledWith(expect.stringContaining('Acme'));

    mPrismaClient.invoice.findMany.mockResolvedValueOnce([]);
    const badFmt = mockReply();
    await exportReport({ query: { format: 'xml', type: 'revenue' } } as any, badFmt);
    expect(badFmt.status).toHaveBeenCalledWith(400);
  });

  it('TwilioWebhookController logs inbound SMS and handles voice gather digits', async () => {
    mPrismaClient.customerPhone.findFirst.mockResolvedValueOnce({
      customerId: 'cust-1',
      customer: { user: { tenantId: 't-1' } },
    });
    mPrismaClient.contactLog.create.mockResolvedValueOnce({});

    const smsReply = mockReply();
    await TwilioWebhookController.handleInboundSms(
      { body: { From: '+15550100', Body: 'Need reschedule', To: '+15559999' }, user: { tenantId: 't-1' } } as any,
      smsReply
    );
    expect(mPrismaClient.contactLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ channel: 'SMS', direction: 'INBOUND' }) })
    );
    expect(smsReply.type).toHaveBeenCalledWith('text/xml');

    const voice1 = mockReply();
    await TwilioWebhookController.handleVoiceGather({ body: { Digits: '1' } } as any, voice1);
    expect(voice1.send).toHaveBeenCalledWith(expect.stringContaining('Connecting you to customer service'));

    const voiceOther = mockReply();
    await TwilioWebhookController.handleVoiceGather({ body: { Digits: '9' } } as any, voiceOther);
    expect(voiceOther.send).toHaveBeenCalledWith(expect.stringContaining('Invalid input'));
  });
});
