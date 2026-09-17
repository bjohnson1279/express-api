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

export const getTechnicianSchedule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // For MVP, we'll fetch jobs assigned to the tech that are scheduled.
    // We could filter by today's date if needed, but we'll fetch all assigned non-completed jobs.
    const jobs = await prisma.job.findMany({
      where: {
        technicianId: id,
        status: { notIn: ['completed', 'cancelled'] }
      },
      include: {
        customer: true,
        property: true
      },
      orderBy: { scheduledStart: 'asc' }
    });
    res.json(jobs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateLocation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { lat, lng } = req.body;
    
    const updated = await prisma.technician.update({
      where: { id },
      data: {
        currentLocationLat: lat,
        currentLocationLng: lng
      }
    });
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
