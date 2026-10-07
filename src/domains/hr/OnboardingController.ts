import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

// Configure multer for local file storage (can be swapped for S3 later)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

export const upload = multer({ storage });

export class OnboardingController {
  
  static async uploadDocument(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { userId, taskId, documentType } = (req.body as any);
      const file = req.file;

      if (!file) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      const document = await prisma.employeeDocument.create({
        data: {
          userId,
          taskId: taskId || null,
          documentType,
          filePath: file.path
        }
      });

      if (taskId) {
        await prisma.employeeOnboardingTask.update({
          where: { id: taskId },
          data: { status: 'completed', completedAt: new Date() }
        });
      }

      reply.status(201).send({ success: true, document });
    } catch (error) {
      console.error('Error uploading document:', error);
      reply.status(500).send({ error: 'Failed to upload document' });
    }
  }

  static async getTasks(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { userId } = (req.params as any);
      const tasks = await prisma.employeeOnboardingTask.findMany({
        where: { userId },
        include: { checklist: true, documents: true }
      });
      reply.send({ tasks });
    } catch (error) {
      console.error('Error fetching tasks:', error);
      reply.status(500).send({ error: 'Failed to fetch tasks' });
    }
  }
}
