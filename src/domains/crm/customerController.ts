import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getCustomers = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const customers = await prisma.customer.findMany({
      include: {
        user: true,
        properties: true
      }
    });
    reply.send(customers);
  } catch (error) {
    console.error(error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};

export const getCustomer = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = (req.params as any);
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        user: true,
        properties: true,
        contracts: true,
        jobs: {
          orderBy: { scheduledStart: 'asc' }
        },
        contactLogs: {
          include: { user: true },
          orderBy: { chronologicalTimestamp: 'desc' }
        },
        internalNotes: {
          include: { author: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    if (!customer) {
      return reply.status(404).send({ error: 'Not found' });
    }
    reply.send(customer);
  } catch (error) {
    console.error(error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};

export const getPreferences = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = (req.params as any);
    let prefs = await prisma.notificationPreference.findUnique({
      where: { customerId: id }
    });
    if (!prefs) {
      prefs = await prisma.notificationPreference.create({
        data: { customerId: id }
      });
    }
    reply.send(prefs);
  } catch (error) {
    console.error(error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};

export const updatePreferences = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = (req.params as any);
    const { smsEnabled, emailEnabled, voiceEnabled, pushEnabled, quietHoursStart, quietHoursEnd } = (req.body as any);
    
    // Check if opting out
    let optOutTimestamp = undefined;
    if (smsEnabled === false && emailEnabled === false) {
      optOutTimestamp = new Date();
    } else if (smsEnabled === true || emailEnabled === true) {
      optOutTimestamp = null;
    }

    const prefs = await prisma.notificationPreference.upsert({
      where: { customerId: id },
      update: {
        smsEnabled,
        emailEnabled,
        voiceEnabled,
        pushEnabled,
        quietHoursStart,
        quietHoursEnd,
        ...(optOutTimestamp !== undefined && { optOutTimestamp })
      },
      create: {
        customerId: id,
        smsEnabled: smsEnabled ?? true,
        emailEnabled: emailEnabled ?? true,
        voiceEnabled: voiceEnabled ?? false,
        pushEnabled: pushEnabled ?? false,
        quietHoursStart,
        quietHoursEnd,
        optOutTimestamp: (smsEnabled === false && emailEnabled === false) ? new Date() : null
      }
    });
    reply.send(prefs);
  } catch (error) {
    console.error(error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};
