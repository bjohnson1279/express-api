import { Router } from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import path from 'path';

const router = Router();
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

router.post('/:id/photos', upload.single('photo'), async (req, res) => {
  try {
    const propertyId = req.params.id;
    const { jobId, caption, tags } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded' });
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
    
    res.status(201).json(photo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

router.get('/:id/photos', async (req, res) => {
  try {
    const propertyId = req.params.id;
    const photos = await prisma.propertyPhoto.findMany({
      where: { propertyId },
      orderBy: { uploadedAt: 'desc' }
    });
    res.json(photos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to retrieve photos' });
  }
});

export default router;
