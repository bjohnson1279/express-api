"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCanvassPins = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getCanvassPins = async (req, res) => {
    try {
        const pins = await prisma.canvassPin.findMany({
            include: {
                salesRep: true
            }
        });
        res.json(pins);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getCanvassPins = getCanvassPins;
