import { FastifyPluginAsync } from 'fastify';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import path from 'path';

const routes: FastifyPluginAsync = async (fastify, opts) => {
const prisma = new PrismaClient();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/photos');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

fastify.post('/:id/photos', upload.single('photo'), async (req, res) => {
  try {
    const propertyId = (req.params as any).id;
    const { jobId, caption, tags } = (req.body as any);
    
    if (!req.file) {
      return res.status(400).send({ error: 'No photo uploaded' });
    }

    const photo = await prisma.propertyPhoto.create({
      data: {
        propertyId,
        jobId: jobId || null,
        url: `/uploads/photos/${req.file.filename}`,
        caption: caption || null,
        tags: tags ? JSON.parse(tags) : null,
      }
    });
    
    res.status(201).send(photo);
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: 'Failed to upload photo' });
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
