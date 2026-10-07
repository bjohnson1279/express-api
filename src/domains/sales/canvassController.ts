import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getCanvassPins = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const pins = await prisma.canvassPin.findMany({
      include: {
        salesRep: true
      }
    });
    reply.send(pins);
  } catch (error) {
    console.error(error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};
