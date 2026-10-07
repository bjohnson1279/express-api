import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../../shared/middleware/authMiddleware';

const prisma = new PrismaClient();

export const getCampaigns = async (req: AuthRequest, reply: FastifyReply) => {
  try {
    const tenantId = req.user?.tenantId;
    const campaigns = await prisma.campaign.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' }
    });
    reply.send(campaigns);
  } catch (error) {
    console.error(error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};

export const createCampaign = async (req: AuthRequest, reply: FastifyReply) => {
  try {
    const tenantId = req.user?.tenantId!;
    const { name, startDate, endDate, budget } = (req.body as any);
    
    const campaign = await prisma.campaign.create({
      data: {
        tenantId,
        name,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        budget: budget ? parseFloat(budget) : null,
        status: 'draft',
      }
    });
    reply.status(201).send(campaign);
  } catch (error) {
    console.error(error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};

export const scheduleFollowup = async (req: AuthRequest, reply: FastifyReply) => {
  try {
    const tenantId = req.user?.tenantId!;
    const { customerId, campaignId, sequenceType, scheduledDate } = (req.body as any);
    
    const followup = await prisma.automatedFollowup.create({
      data: {
        tenantId,
        customerId,
        campaignId,
        sequenceType,
        scheduledDate: new Date(scheduledDate),
      }
    });
    reply.status(201).send(followup);
  } catch (error) {
    console.error(error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};
