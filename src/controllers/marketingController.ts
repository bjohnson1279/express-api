import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/authMiddleware';

const prisma = new PrismaClient();

export const getCampaigns = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const campaigns = await prisma.campaign.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(campaigns);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId!;
    const { name, startDate, endDate, budget } = req.body;
    
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
    res.status(201).json(campaign);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const scheduleFollowup = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId!;
    const { customerId, campaignId, sequenceType, scheduledDate } = req.body;
    
    const followup = await prisma.automatedFollowup.create({
      data: {
        tenantId,
        customerId,
        campaignId,
        sequenceType,
        scheduledDate: new Date(scheduledDate),
      }
    });
    res.status(201).json(followup);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
