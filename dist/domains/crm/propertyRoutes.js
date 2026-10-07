"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const multer_1 = __importDefault(require("multer"));
const client_1 = require("@prisma/client");
const routes = async (fastify, opts) => {
    const prisma = new client_1.PrismaClient();
    const storage = multer_1.default.diskStorage({
        destination: (req, file, cb) => {
            cb(null, 'uploads/photos');
        },
        filename: (req, file, cb) => {
            cb(null, `${Date.now()}-${file.originalname}`);
        }
    });
    const upload = (0, multer_1.default)({ storage });
    fastify.post('/:id/photos', upload.single('photo'), async (req, res) => {
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
        }
        catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to upload photo' });
        }
    });
    fastify.get('/:id/photos', async (req, res) => {
        try {
            const propertyId = req.params.id;
            const photos = await prisma.propertyPhoto.findMany({
                where: { propertyId },
                orderBy: { uploadedAt: 'desc' }
            });
            res.json(photos);
        }
        catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to retrieve photos' });
        }
    });
};
exports.default = routes;
