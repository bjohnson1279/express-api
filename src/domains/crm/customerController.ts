import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getCustomers = async (req: Request, res: Response) => {
  try {
    const customers = await prisma.customer.findMany({
      include: {
        user: true,
        properties: true
      }
    });
    res.json(customers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getCustomer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
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
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(customer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPreferences = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let prefs = await prisma.notificationPreference.findUnique({
      where: { customerId: id }
    });
    if (!prefs) {
      prefs = await prisma.notificationPreference.create({
        data: { customerId: id }
      });
    }
    res.json(prefs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updatePreferences = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { smsEnabled, emailEnabled, voiceEnabled, pushEnabled, quietHoursStart, quietHoursEnd } = req.body;
    
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
    res.json(prefs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
