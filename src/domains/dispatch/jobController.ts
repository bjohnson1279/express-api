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

export const getJobsCalendar = async (req: Request, res: Response) => {
  try {
    const customerId = req.query.customerId as string;
    
    const whereClause: any = {
      scheduledStart: { not: null }
    };
    if (customerId) {
      whereClause.customerId = customerId;
    }

    const jobs = await prisma.job.findMany({
      where: whereClause,
      include: {
        customer: true,
        property: true,
      }
    });

    const calendarEvents = jobs.map(job => {
      let color = '#3b82f6'; // blue for scheduled/draft
      if (job.status === 'completed' || job.status === 'invoiced') color = '#10b981'; // green
      if (job.status === 'in_progress') color = '#f59e0b'; // amber
      if (job.status === 'cancelled') color = '#ef4444'; // red
      
      return {
        id: job.id,
        title: `${job.customer.name} - ${job.property.address}`,
        start: job.scheduledStart,
        end: job.scheduledEnd || new Date(job.scheduledStart!.getTime() + 60 * 60 * 1000), // Default 1hr
        status: job.status,
        color
      };
    });

    res.json(calendarEvents);
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

export const clockIn = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { lat, lng } = req.body;
    
    const updated = await prisma.job.update({
      where: { id },
      data: {
        actualArrival: new Date(),
        status: 'in_progress'
      }
    });
    
    if (lat && lng && updated.technicianId) {
       await prisma.technician.update({
          where: { id: updated.technicianId },
          data: { currentLocationLat: lat, currentLocationLng: lng }
       });
    }

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const clockOut = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    
    const actualDeparture = new Date();
    let onSiteTimeMinutes = 0;
    
    if (job.actualArrival) {
      const diffMs = actualDeparture.getTime() - job.actualArrival.getTime();
      onSiteTimeMinutes = Math.floor(diffMs / 60000);
    }
    
    const updated = await prisma.job.update({
      where: { id },
      data: {
        actualDeparture,
        onSiteTimeMinutes,
        status: 'completed'
      }
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
