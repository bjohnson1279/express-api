import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getStaff = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const staff = await prisma.user.findMany({
      where: {
        role: { not: 'CUSTOMER' }
      },
      include: {
        certifications: {
          include: { course: true }
        },
        commissions: true
      },
      orderBy: { email: 'asc' }
    });
    reply.send(staff);
  } catch (error) {
    console.error(error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};

export const getCourses = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const courses = await prisma.trainingCourse.findMany();
    reply.send(courses);
  } catch (error) {
    console.error(error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};

export const assignCertification = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { userId, courseId, expiresAt } = (req.body as any);
    const cert = await prisma.employeeCertification.create({
      data: {
        userId,
        courseId,
        completedAt: new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        status: 'active'
      },
      include: { course: true }
    });
    reply.status(201).send(cert);
  } catch (error) {
    console.error(error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};
