"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnboardingController = exports.upload = void 0;
const client_1 = require("@prisma/client");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const prisma = new client_1.PrismaClient();
// Configure multer for local file storage (can be swapped for S3 later)
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path_1.default.join(__dirname, '../../uploads');
        if (!fs_1.default.existsSync(uploadPath)) {
            fs_1.default.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path_1.default.extname(file.originalname));
    }
});
exports.upload = (0, multer_1.default)({ storage });
class OnboardingController {
    static async uploadDocument(req, reply) {
        try {
            const { userId, taskId, documentType } = req.body;
            const file = req.file;
            if (!file) {
                return reply.status(400).json({ error: 'No file uploaded' });
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
            reply.status(201).json({ success: true, document });
        }
        catch (error) {
            console.error('Error uploading document:', error);
            reply.status(500).json({ error: 'Failed to upload document' });
        }
    }
    static async getTasks(req, reply) {
        try {
            const { userId } = req.params;
            const tasks = await prisma.employeeOnboardingTask.findMany({
                where: { userId },
                include: { checklist: true, documents: true }
            });
            reply.send({ tasks });
        }
        catch (error) {
            console.error('Error fetching tasks:', error);
            reply.status(500).json({ error: 'Failed to fetch tasks' });
        }
    }
}
exports.OnboardingController = OnboardingController;
