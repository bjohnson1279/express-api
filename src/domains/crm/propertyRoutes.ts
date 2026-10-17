import { FastifyPluginAsync } from 'fastify';
import { saveMultipartUpload } from '../../shared/multipartUpload';
import { PrismaClient } from '../../shared/database';
import path from 'path';

const routes: FastifyPluginAsync = async (fastify, opts) => {
const prisma = new PrismaClient();

fastify.post('/:id/photos', async (req, res) => {
  try {
    const propertyId = (req.params as any).id;
    const file = await saveMultipartUpload(req, 'photo', path.join(process.cwd(), 'uploads/photos'));
    const { jobId, caption, tags } = file.fields;

    const photo = await prisma.propertyPhoto.create({
      data: {
        propertyId,
        jobId: jobId || null,
        url: `/uploads/photos/${file.filename}`,
        caption: caption || null,
        tags: tags ? JSON.parse(tags) : null,
      }
    });
    
    res.status(201).send(photo);
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode || 500;
    console.error(error);
    res.status(status).send({ error: status < 500 ? (error as Error).message : 'Failed to upload photo' });
  }
});

fastify.get('/:id/photos', async (req, res) => {
  try {
    const propertyId = (req.params as any).id;
    const photos = await prisma.propertyPhoto.findMany({
      where: { propertyId },
      orderBy: { uploadedAt: 'desc' }
    });
    res.send(photos);
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: 'Failed to retrieve photos' });
  }
});

};

export default routes;
