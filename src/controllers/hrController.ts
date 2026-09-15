import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getStaff = async (req: Request, res: Response) => {
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
    res.json(staff);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getCourses = async (req: Request, res: Response) => {
  try {
    const courses = await prisma.trainingCourse.findMany();
    res.json(courses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const assignCertification = async (req: Request, res: Response) => {
  try {
    const { userId, courseId, expiresAt } = req.body;
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
    res.status(201).json(cert);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
