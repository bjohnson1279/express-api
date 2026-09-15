import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getContracts = async (req: Request, res: Response) => {
  try {
    const contracts = await prisma.serviceContract.findMany({
      include: {
        customer: true,
        property: true
      }
    });
    res.json(contracts);
  } catch (error) {
    console.error('Error fetching contracts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
