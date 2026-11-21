const mPrismaClient = {
  chatConversation: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  chatMessage: {
    count: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn(),
  },
  customer: {
    findFirst: jest.fn(),
  },
  contactLog: {
    create: jest.fn(),
  },
  user: {
    findFirst: jest.fn(),
  },
  cannedResponse: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mPrismaClient),
}));

import { ChatController } from '../src/domains/comms/chatController';

function mockReply() {
  const res: any = {
    status: jest.fn(),
    code: jest.fn(),
    send: jest.fn(),
  };
  res.status.mockReturnValue(res);
  res.code.mockReturnValue(res);
  return res;
}

describe('ChatController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getConversations enriches conversations with unreadCount', async () => {
    mPrismaClient.chatConversation.findMany.mockResolvedValueOnce([
      { id: 'c-1', status: 'OPEN', messages: [{ id: 'm-1', messageText: 'Hi' }] },
    ]);
    mPrismaClient.chatMessage.count.mockResolvedValueOnce(3);

    const reply = mockReply();
    await ChatController.getConversations({ query: { status: 'OPEN' }, user: { tenantId: 't-1' } } as any, reply);
    expect(reply.send).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'c-1', unreadCount: 3, lastMessage: { id: 'm-1', messageText: 'Hi' } }),
    ]);
  });

  it('getConversation marks customer messages as read and returns 404 if missing', async () => {
    mPrismaClient.chatConversation.findFirst.mockResolvedValueOnce(null);
    const notFound = mockReply();
    await ChatController.getConversation({ params: { id: 'c-missing' }, user: { tenantId: 't-1' } } as any, notFound);
    expect(notFound.status).toHaveBeenCalledWith(404);

    mPrismaClient.chatConversation.findFirst.mockResolvedValueOnce({ id: 'c-1', messages: [] });
    mPrismaClient.chatMessage.updateMany.mockResolvedValueOnce({ count: 2 });
    const ok = mockReply();
    await ChatController.getConversation({ params: { id: 'c-1' }, user: { tenantId: 't-1' } } as any, ok);
    expect(mPrismaClient.chatMessage.updateMany).toHaveBeenCalledTimes(1);
    expect(ok.send).toHaveBeenCalledWith({ id: 'c-1', messages: [] });
  });

  it('createConversation validates customerId and creates initial message + contactLog', async () => {
    const badReply = mockReply();
    await ChatController.createConversation({ body: {}, user: { tenantId: 't-1' } } as any, badReply);
    expect(badReply.status).toHaveBeenCalledWith(400);

    mPrismaClient.customer.findFirst.mockResolvedValueOnce({ id: 'cust-1' });
    mPrismaClient.chatConversation.create.mockResolvedValueOnce({
      id: 'c-new',
      customerId: 'cust-1',
      customer: { name: 'Jane' },
    });
    mPrismaClient.chatMessage.create.mockResolvedValueOnce({ id: 'm-new', messageText: 'Need help' });
    mPrismaClient.contactLog.create.mockResolvedValueOnce({});

    const okReply = mockReply();
    await ChatController.createConversation(
      {
        body: { customerId: 'cust-1', subject: 'Billing', initialMessage: 'Need help' },
        user: { tenantId: 't-1' },
      } as any,
      okReply
    );
    expect(okReply.status).toHaveBeenCalledWith(201);
    expect(mPrismaClient.contactLog.create).toHaveBeenCalledTimes(1);
  });

  it('sendMessage rejects empty text and creates message for valid conversation', async () => {
    const emptyReply = mockReply();
    await ChatController.sendMessage(
      { params: { id: 'c-1' }, body: { messageText: '   ' }, user: { tenantId: 't-1', id: 'u-1' } } as any,
      emptyReply
    );
    expect(emptyReply.status).toHaveBeenCalledWith(400);

    mPrismaClient.chatConversation.findFirst.mockResolvedValueOnce({
      id: 'c-1',
      customerId: 'cust-1',
      status: 'WAITING_ON_AGENT',
      customer: { name: 'Jane' },
    });
    mPrismaClient.chatMessage.create.mockResolvedValueOnce({ id: 'm-2', messageText: 'On our way' });
    mPrismaClient.chatConversation.update.mockResolvedValueOnce({});
    mPrismaClient.contactLog.create.mockResolvedValueOnce({});

    const okReply = mockReply();
    await ChatController.sendMessage(
      { params: { id: 'c-1' }, body: { senderType: 'CSR', messageText: 'On our way' }, user: { tenantId: 't-1', id: 'u-1' } } as any,
      okReply
    );
    expect(okReply.status).toHaveBeenCalledWith(201);
  });

  it('canned responses list and create normalize slash shortcut', async () => {
    mPrismaClient.cannedResponse.findMany.mockResolvedValueOnce([{ id: 'cr-1', shortcut: '/eta' }]);
    const listReply = mockReply();
    await ChatController.getCannedResponses({ user: { tenantId: 't-1' } } as any, listReply);
    expect(listReply.send).toHaveBeenCalledWith([{ id: 'cr-1', shortcut: '/eta' }]);

    mPrismaClient.cannedResponse.create.mockResolvedValueOnce({ id: 'cr-2', shortcut: '/hello' });
    const createReply = mockReply();
    await ChatController.createCannedResponse(
      { body: { shortcut: 'hello', title: 'Greeting', content: 'Hello!' }, user: { tenantId: 't-1' } } as any,
      createReply
    );
    expect(mPrismaClient.cannedResponse.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ shortcut: '/hello' }) })
    );
    expect(createReply.status).toHaveBeenCalledWith(201);
  });
});
