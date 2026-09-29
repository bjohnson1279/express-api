import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { eventBus } from '../comms/eventBus';

const prisma = new PrismaClient();

export const getJobs = async (req: Request, res: Response) => {
  try {
    const jobs = await prisma.job.findMany({
      include: {
        customer: true,
        property: true,
        technician: {
          include: { user: true }
        }
      }
    });
    res.json(jobs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createJob = async (req: Request, res: Response) => {
  try {
    const { tenantId, customerId, propertyId, status, scheduledStart, contractId } = req.body;
    const newJob = await prisma.job.create({
      data: {
        tenantId,
        customerId,
        propertyId,
        status: status || 'draft',
        scheduledStart: scheduledStart ? new Date(scheduledStart) : null,
        contractId: contractId || null
      }
    });
    res.status(201).json(newJob);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateJob = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { technicianId, status } = req.body;
    
    // Explicitly handle null for unassigning
    const data: any = {};
    if (technicianId !== undefined) data.technicianId = technicianId;
    if (status !== undefined) data.status = status;

    const updated = await prisma.job.update({
      where: { id },
      data
    });

    if (technicianId !== undefined && technicianId !== null) {
      eventBus.broadcast('job_assigned', updated);
    }

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
