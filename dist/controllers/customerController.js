"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCustomer = exports.getCustomers = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getCustomers = async (req, res) => {
    try {
        const customers = await prisma.customer.findMany({
            include: {
                user: true,
                properties: true
            }
        });
        res.json(customers);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getCustomers = getCustomers;
const getCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        const customer = await prisma.customer.findUnique({
            where: { id },
            include: {
                user: true,
                properties: true,
                contracts: true,
                jobs: {
                    orderBy: { scheduledStart: 'asc' }
                },
                contactLogs: {
                    include: { user: true },
                    orderBy: { chronologicalTimestamp: 'desc' }
                },
                internalNotes: {
                    include: { author: true },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
        if (!customer) {
            return res.status(404).json({ error: 'Not found' });
        }
        res.json(customer);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getCustomer = getCustomer;
