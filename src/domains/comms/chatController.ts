import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { eventBus } from './eventBus';

const prisma = new PrismaClient();

export class ChatController {
  /**
   * List chat conversations with customer and assigned CSR details
   */
  static async getConversations(req: Request, res: Response) {
    try {
      const { status, customerId, assignedCsrId } = req.query;
      const tenantId = (req as any).tenantId || req.headers['x-tenant-id'] || '3fa85f64-5717-4562-b3fc-2c963f66afa6';

      const where: any = { tenantId: String(tenantId) };
      if (status && status !== 'ALL') {
        where.status = String(status);
      }
      if (customerId) {
        where.customerId = String(customerId);
      }
      if (assignedCsrId) {
        where.assignedCsrId = String(assignedCsrId);
      }

      const conversations = await prisma.chatConversation.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              user: {
                select: { email: true }
              }
            }
          },
          assignedCsr: {
            select: {
              id: true,
              email: true,
              role: true
            }
          },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' }
          }
        },
        orderBy: { lastMessageAt: 'desc' }
      });

      // Calculate unread count for each conversation
      const enriched = await Promise.all(
        conversations.map(async (conv: any) => {
          const unreadCount = await prisma.chatMessage.count({
            where: {
              conversationId: conv.id,
              isRead: false,
              senderType: 'CUSTOMER'
            }
          });
          return {
            ...conv,
            unreadCount,
            lastMessage: conv.messages?.[0] || null
          };
        })
      );

      return res.json(enriched);
    } catch (error: any) {
      console.error('Error fetching chat conversations:', error);
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Get single conversation with full message history
   */
  static async getConversation(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const tenantId = (req as any).tenantId || req.headers['x-tenant-id'] || '3fa85f64-5717-4562-b3fc-2c963f66afa6';

      const conversation = await prisma.chatConversation.findFirst({
        where: { id, tenantId: String(tenantId) },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              user: {
                select: { email: true }
              }
            }
          },
          assignedCsr: {
            select: {
              id: true,
              email: true,
              role: true
            }
          },
          messages: {
            orderBy: { createdAt: 'asc' }
          }
        }
      });

      if (!conversation) {
        return res.status(404).json({ error: 'Chat conversation not found' });
      }

      // Mark incoming customer messages as read when CSR loads conversation
      await prisma.chatMessage.updateMany({
        where: {
          conversationId: id,
          isRead: false,
          senderType: 'CUSTOMER'
        },
        data: { isRead: true }
      });

      return res.json(conversation);
    } catch (error: any) {
      console.error('Error fetching conversation:', error);
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Start a new chat conversation
   */
  static async createConversation(req: Request, res: Response) {
    try {
      const { customerId, subject, initialMessage, senderType = 'CUSTOMER', senderName } = req.body;
      const tenantId = (req as any).tenantId || req.headers['x-tenant-id'] || '3fa85f64-5717-4562-b3fc-2c963f66afa6';

      if (!customerId) {
        return res.status(400).json({ error: 'customerId is required' });
      }

      const conversation = await prisma.chatConversation.create({
        data: {
          tenantId: String(tenantId),
          customerId,
          subject: subject || 'General Customer Inquiry',
          status: 'WAITING_ON_AGENT',
          lastMessageAt: new Date()
        },
        include: {
          customer: true
        }
      });

      let createdMessage: any = null;
      if (initialMessage) {
        createdMessage = await prisma.chatMessage.create({
          data: {
            tenantId: String(tenantId),
            conversationId: conversation.id,
            senderType,
            senderName: senderName || conversation.customer.name,
            messageText: initialMessage
          }
        });

        // Persist to contact_logs
        await prisma.contactLog.create({
          data: {
            tenantId: String(tenantId),
            customerId,
            channel: 'CHAT',
            direction: senderType === 'CUSTOMER' ? 'INBOUND' : 'OUTBOUND',
            summary: initialMessage
          }
        });

        eventBus.broadcast('chat_message', {
          conversationId: conversation.id,
          message: createdMessage
        });
      }

      eventBus.broadcast('conversation_created', { conversation });

      return res.status(201).json({
        ...conversation,
        initialMessage: createdMessage
      });
    } catch (error: any) {
      console.error('Error creating chat conversation:', error);
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Send a message in a conversation (Customer or CSR)
   */
  static async sendMessage(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { senderType = 'CSR', senderId, senderName, messageText } = req.body;
      const tenantId = (req as any).tenantId || req.headers['x-tenant-id'] || '3fa85f64-5717-4562-b3fc-2c963f66afa6';

      if (!messageText || !messageText.trim()) {
        return res.status(400).json({ error: 'messageText cannot be empty' });
      }

      const conversation = await prisma.chatConversation.findFirst({
        where: { id, tenantId: String(tenantId) },
        include: { customer: true }
      });

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      // 1. Create message
      const message = await prisma.chatMessage.create({
        data: {
          tenantId: String(tenantId),
          conversationId: id,
          senderType,
          senderId: senderId || null,
          senderName: senderName || (senderType === 'CSR' ? 'Customer Support' : conversation.customer.name),
          messageText: messageText.trim()
        }
      });

      // 2. Update conversation status and lastMessageAt
      const newStatus = senderType === 'CUSTOMER' ? 'WAITING_ON_AGENT' : 'WAITING_ON_CUSTOMER';
      await prisma.chatConversation.update({
        where: { id },
        data: {
          lastMessageAt: new Date(),
          status: conversation.status === 'RESOLVED' ? 'OPEN' : newStatus,
          assignedCsrId: (senderType === 'CSR' && senderId && !conversation.assignedCsrId) ? senderId : conversation.assignedCsrId
        }
      });

      // 3. Persist to contact_logs
      await prisma.contactLog.create({
        data: {
          tenantId: String(tenantId),
          customerId: conversation.customerId,
          userId: senderType === 'CSR' ? senderId : null,
          channel: 'CHAT',
          direction: senderType === 'CUSTOMER' ? 'INBOUND' : 'OUTBOUND',
          summary: messageText.trim()
        }
      });

      // 4. Real-time broadcast
      eventBus.broadcast('chat_message', {
        conversationId: id,
        message
      });

      return res.status(201).json(message);
    } catch (error: any) {
      console.error('Error sending message:', error);
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Update conversation status or CSR assignment
   */
  static async updateConversation(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status, assignedCsrId, subject } = req.body;
      const tenantId = (req as any).tenantId || req.headers['x-tenant-id'] || '3fa85f64-5717-4562-b3fc-2c963f66afa6';

      const updateData: any = { updatedAt: new Date() };
      if (status) updateData.status = status;
      if (assignedCsrId !== undefined) updateData.assignedCsrId = assignedCsrId;
      if (subject) updateData.subject = subject;

      const updated = await prisma.chatConversation.update({
        where: { id },
        data: updateData,
        include: {
          customer: true,
          assignedCsr: true
        }
      });

      eventBus.broadcast('conversation_updated', { conversation: updated });

      return res.json(updated);
    } catch (error: any) {
      console.error('Error updating conversation:', error);
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * List canned responses for CSR quick-reply
   */
  static async getCannedResponses(req: Request, res: Response) {
    try {
      const tenantId = (req as any).tenantId || req.headers['x-tenant-id'] || '3fa85f64-5717-4562-b3fc-2c963f66afa6';
      const responses = await prisma.cannedResponse.findMany({
        where: { tenantId: String(tenantId) },
        orderBy: { shortcut: 'asc' }
      });
      return res.json(responses);
    } catch (error: any) {
      console.error('Error fetching canned responses:', error);
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * Create a new canned response
   */
  static async createCannedResponse(req: Request, res: Response) {
    try {
      const { shortcut, title, category = 'GENERAL', content } = req.body;
      const tenantId = (req as any).tenantId || req.headers['x-tenant-id'] || '3fa85f64-5717-4562-b3fc-2c963f66afa6';

      if (!shortcut || !title || !content) {
        return res.status(400).json({ error: 'shortcut, title, and content are required' });
      }

      const canned = await prisma.cannedResponse.create({
        data: {
          tenantId: String(tenantId),
          shortcut: shortcut.startsWith('/') ? shortcut : `/${shortcut}`,
          title,
          category,
          content
        }
      });

      return res.status(201).json(canned);
    } catch (error: any) {
      console.error('Error creating canned response:', error);
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
}
