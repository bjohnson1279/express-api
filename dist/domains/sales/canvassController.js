"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCanvassPins = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getCanvassPins = async (req, reply) => {
    try {
        const pins = await prisma.canvassPin.findMany({
            include: {
                salesRep: true
            }
        });
        reply.send(pins);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.getCanvassPins = getCanvassPins;
