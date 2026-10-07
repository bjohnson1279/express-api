import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/v1/booking/slots?date=YYYY-MM-DD
export const getAvailableSlots = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { date } = (req.query as any);
    if (!date) return reply.status(400).send({ error: 'Date is required' });

    // Mock slots for now. In a real application, we'd query Jobs 
    // for this date and ensure we have at least one Technician without overlap.
    const slots = ["08:00", "10:00", "12:00", "14:00"];
    const result = slots.map(time => ({ time, available: true }));
    
    reply.send(result);
  } catch (error) {
    console.error(error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};

// POST /api/v1/booking
export const createBooking = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { tenantId, customerId, propertyId, date, time } = (req.body as any);
    
    if (!tenantId || !customerId || !propertyId || !date || !time) {
      return reply.status(400).send({ error: 'Missing required booking fields' });
    }

    const startDt = new Date(`${date}T${time}:00Z`);
    const endDt = new Date(startDt.getTime() + 2 * 60 * 60 * 1000); // Assume 2-hour jobs

    const job = await prisma.job.create({
      data: {
        tenantId,
        customerId,
        propertyId,
        status: 'scheduled',
        scheduledStart: startDt,
        scheduledEnd: endDt
      }
    });

    reply.status(201).send(job);
  } catch (error) {
    console.error(error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};
