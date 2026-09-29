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
