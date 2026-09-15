import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getTechnicians = async (req: Request, res: Response) => {
  try {
    const techs = await prisma.technician.findMany({
      include: { user: true }
    });
    res.json(techs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
