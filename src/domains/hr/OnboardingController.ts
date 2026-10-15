import { unlink } from 'fs/promises';
import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { saveMultipartUpload } from '../../shared/multipartUpload';
import path from 'path';


const prisma = new PrismaClient();

export class OnboardingController {
  
  static async uploadDocument(req: FastifyRequest, reply: FastifyReply) {
    try {
      const file = await saveMultipartUpload(req, 'document', path.join(process.cwd(), 'uploads/onboarding'));
      const { userId, taskId, documentType } = file.fields;

      const owner = await prisma.user.findFirst({ where: { id: userId, tenantId: (req as any).user.tenantId }, select: { id: true } });
      const task = !taskId || await prisma.employeeOnboardingTask.findFirst({ where: { id: taskId, userId, user: { tenantId: (req as any).user.tenantId } }, select: { id: true } });
      if (!owner || !task) { await unlink(file.filepath); return reply.status(404).send({ error: 'User or task not found' }); }
      const document = await prisma.employeeDocument.create({
        data: {
          userId,
          taskId: taskId || null,
          documentType,
          filePath: file.filepath
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
      const status = (error as { statusCode?: number }).statusCode || 500;
      reply.status(status).send({ error: status < 500 ? (error as Error).message : 'Failed to upload document' });
    }
  }

  static async getTasks(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { userId } = (req.params as any);
      const tasks = await prisma.employeeOnboardingTask.findMany({
        where: { userId, user: { tenantId: (req as any).user.tenantId } },
        include: { checklist: true, documents: true }
      });
      reply.send({ tasks });
    } catch (error) {
      console.error('Error fetching tasks:', error);
      reply.status(500).send({ error: 'Failed to fetch tasks' });
    }
  }
}
