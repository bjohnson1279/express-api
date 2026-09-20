"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateJob = exports.createJob = exports.getJobs = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getJobs = async (req, res) => {
    try {
        const jobs = await prisma.job.findMany({
            include: {
                customer: true,
                property: true,
                technician: {
                    include: { user: true }
                }
            }
        });
        res.json(jobs);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getJobs = getJobs;
const createJob = async (req, res) => {
    try {
        const { tenantId, customerId, propertyId, status, scheduledStart, contractId } = req.body;
        const newJob = await prisma.job.create({
            data: {
                tenantId,
                customerId,
                propertyId,
                status: status || 'draft',
                scheduledStart: scheduledStart ? new Date(scheduledStart) : null,
                contractId: contractId || null
            }
        });
        res.status(201).json(newJob);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.createJob = createJob;
const updateJob = async (req, res) => {
    try {
        const { id } = req.params;
        const { technicianId, status } = req.body;
        // Explicitly handle null for unassigning
        const data = {};
        if (technicianId !== undefined)
            data.technicianId = technicianId;
        if (status !== undefined)
            data.status = status;
        const updated = await prisma.job.update({
            where: { id },
            data
        });
        res.json(updated);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateJob = updateJob;
