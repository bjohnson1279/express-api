"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePreferences = exports.getPreferences = exports.getCustomer = exports.getCustomers = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getCustomers = async (req, reply) => {
    try {
        const customers = await prisma.customer.findMany({
            include: {
                user: true,
                properties: true
            }
        });
        reply.send(customers);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.getCustomers = getCustomers;
const getCustomer = async (req, reply) => {
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
            return reply.status(404).json({ error: 'Not found' });
        }
        reply.send(customer);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.getCustomer = getCustomer;
const getPreferences = async (req, reply) => {
    try {
        const { id } = req.params;
        let prefs = await prisma.notificationPreference.findUnique({
            where: { customerId: id }
        });
        if (!prefs) {
            prefs = await prisma.notificationPreference.create({
                data: { customerId: id }
            });
        }
        reply.send(prefs);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.getPreferences = getPreferences;
const updatePreferences = async (req, reply) => {
    try {
        const { id } = req.params;
        const { smsEnabled, emailEnabled, voiceEnabled, pushEnabled, quietHoursStart, quietHoursEnd } = req.body;
        // Check if opting out
        let optOutTimestamp = undefined;
        if (smsEnabled === false && emailEnabled === false) {
            optOutTimestamp = new Date();
        }
        else if (smsEnabled === true || emailEnabled === true) {
            optOutTimestamp = null;
        }
        const prefs = await prisma.notificationPreference.upsert({
            where: { customerId: id },
            update: {
                smsEnabled,
                emailEnabled,
                voiceEnabled,
                pushEnabled,
                quietHoursStart,
                quietHoursEnd,
                ...(optOutTimestamp !== undefined && { optOutTimestamp })
            },
            create: {
                customerId: id,
                smsEnabled: smsEnabled ?? true,
                emailEnabled: emailEnabled ?? true,
                voiceEnabled: voiceEnabled ?? false,
                pushEnabled: pushEnabled ?? false,
                quietHoursStart,
                quietHoursEnd,
                optOutTimestamp: (smsEnabled === false && emailEnabled === false) ? new Date() : null
            }
        });
        reply.send(prefs);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.updatePreferences = updatePreferences;
