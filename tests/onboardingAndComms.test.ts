const mPrismaClient = {
  employeeDocument: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  employeeOnboardingTask: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  canvassPin: {
    findMany: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mPrismaClient),
}));

const mockMessagesCreate = jest.fn();
const mockCallsCreate = jest.fn();
jest.mock('twilio', () =>
  jest.fn(() => ({
    messages: { create: mockMessagesCreate },
    calls: { create: mockCallsCreate },
  }))
);

const mockSendMail = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
}));

const mockConstructEvent = jest.fn();
jest.mock('../src/domains/billing/stripeService', () => ({
  stripeService: {
    constructEvent: (...args: any[]) => mockConstructEvent(...args),
  },
}));

import { OnboardingController } from '../src/domains/hr/OnboardingController';
import { NotificationService } from '../src/domains/comms/NotificationService';
import { stripeWebhook } from '../src/domains/billing/webhookController';
import { getCanvassPins } from '../src/domains/sales/canvassController';

function mockReply() {
  const res: any = { status: jest.fn(), send: jest.fn(), header: jest.fn() };
  res.status.mockReturnValue(res);
  res.header.mockReturnValue(res);
  return res;
}

describe('Onboarding, NotificationService, Stripe Webhook & Canvass', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('OnboardingController.getTasks returns tenant-scoped tasks and downloadDocument rejects bad IDs', async () => {
    mPrismaClient.employeeOnboardingTask.findMany.mockResolvedValueOnce([{ id: 'task-1', status: 'pending' }]);
    const tasksReply = mockReply();
    await OnboardingController.getTasks({ params: { userId: 'u-1' }, user: { tenantId: 't-1' } } as any, tasksReply);
    expect(tasksReply.send).toHaveBeenCalledWith({ tasks: [{ id: 'task-1', status: 'pending' }] });

    const badDoc = mockReply();
    await OnboardingController.downloadDocument({ params: { id: '../secret' }, user: { tenantId: 't-1' } } as any, badDoc);
    expect(badDoc.status).toHaveBeenCalledWith(404);
  });

  it('NotificationService sends SMS, robocalls, and emails', async () => {
    mockMessagesCreate.mockResolvedValueOnce({ sid: 'SM123' });
    mockCallsCreate.mockResolvedValueOnce({ sid: 'CA456' });
    mockSendMail.mockResolvedValueOnce({ messageId: 'MSG789' });

    const svc = new NotificationService();
    expect(await svc.sendSMS('+15550101', 'Hello')).toEqual({ success: true, messageId: 'SM123' });
    expect(await svc.sendRobocall('+15550101', 'Reminder')).toEqual({ success: true, callId: 'CA456' });
    expect(await svc.sendEmail('a@b.com', 'Subj', 'Body')).toEqual({ success: true, messageId: 'MSG789' });
  });

  it('stripeWebhook validates signature and handles payment_intent events', () => {
    const missingSig = mockReply();
    stripeWebhook({ headers: {}, body: Buffer.from('{}') } as any, missingSig);
    expect(missingSig.status).toHaveBeenCalledWith(400);

    mockConstructEvent.mockImplementationOnce(() => {
      throw new Error('Invalid signature');
    });
    const badSig = mockReply();
    stripeWebhook({ headers: { 'stripe-signature': 'bad' }, body: Buffer.from('{}') } as any, badSig);
    expect(badSig.status).toHaveBeenCalledWith(400);

    mockConstructEvent.mockReturnValueOnce({ type: 'payment_intent.succeeded', data: { object: { id: 'pi_1' } } });
    const okSig = mockReply();
    stripeWebhook({ headers: { 'stripe-signature': 'valid' }, body: Buffer.from('{}') } as any, okSig);
    expect(okSig.send).toHaveBeenCalledWith({ received: true });
  });

  it('getCanvassPins returns canvass pins', async () => {
    mPrismaClient.canvassPin.findMany.mockResolvedValueOnce([{ id: 'pin-1', status: 'SOLD' }]);
    const reply = mockReply();
    await getCanvassPins({} as any, reply);
    expect(reply.send).toHaveBeenCalledWith([{ id: 'pin-1', status: 'SOLD' }]);
  });
});
