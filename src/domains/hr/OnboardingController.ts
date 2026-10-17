import fs from 'fs';
import { unlink } from 'fs/promises';
import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '../../shared/database';
import { saveMultipartUpload } from '../../shared/multipartUpload';
import path from 'path';


const prisma = new PrismaClient();

export class OnboardingController {
  

  static async downloadDocument(req: FastifyRequest, reply: FastifyReply) {
    try {
      const id = String((req.params as any).id);
      if (!/^[0-9a-f-]{36}$/i.test(id)) return reply.status(404).send({ error: 'Document not found' });
      const document = await prisma.employeeDocument.findFirst({ where: { id, user: { tenantId: (req as any).user.tenantId } }, select: { filePath: true } });
      if (!document) return reply.status(404).send({ error: 'Document not found' });
      const file = await fs.promises.realpath(document.filePath);
      const roots = await Promise.all(['uploads/onboarding'].map(root => fs.promises.realpath(path.join(process.cwd(), root)).catch(() => '')));
      if (!roots.some(root => root && file.startsWith(root + path.sep)) || !(await fs.promises.stat(file)).isFile()) return reply.status(404).send({ error: 'Document not found' });
      return reply.header('Cache-Control','no-store').header('Content-Type','application/octet-stream').header('Content-Disposition','attachment').send(fs.createReadStream(file));
    } catch { return reply.status(404).send({ error: 'Document not found' }); }
  }
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
