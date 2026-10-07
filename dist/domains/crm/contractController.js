"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContracts = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getContracts = async (req, reply) => {
    try {
        const contracts = await prisma.serviceContract.findMany({
            include: {
                customer: true,
                property: true
            }
        });
        reply.send(contracts);
    }
    catch (error) {
        console.error('Error fetching contracts:', error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.getContracts = getContracts;
