import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getContracts = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const contracts = await prisma.serviceContract.findMany({
      include: {
        customer: true,
        property: true
      }
    });
    reply.send(contracts);
  } catch (error) {
    console.error('Error fetching contracts:', error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};
