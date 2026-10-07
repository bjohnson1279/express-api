import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { eventBus } from '../comms/eventBus';

const prisma = new PrismaClient();

export const getTechnicians = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const techs = await prisma.technician.findMany({
      include: { user: true }
    });
    reply.send(techs);
  } catch (error) {
    console.error(error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};

export const getTechnicianSchedule = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = (req.params as any);
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
    reply.send(jobs);
  } catch (error) {
    console.error(error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};

export const updateLocation = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = (req.params as any);
    const { lat, lng } = (req.body as any);
    
    const updated = await prisma.technician.update({
      where: { id },
      data: {
        currentLocationLat: lat,
        currentLocationLng: lng
      }
    });
    eventBus.broadcast('tech_updated', updated);
    reply.send(updated);
  } catch (error) {
    console.error(error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};
