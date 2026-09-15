import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getCanvassPins = async (req: Request, res: Response) => {
  try {
    const pins = await prisma.canvassPin.findMany({
      include: {
        salesRep: true
      }
    });
    res.json(pins);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
