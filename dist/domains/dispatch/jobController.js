"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clockOut = exports.clockIn = exports.updateJob = exports.createJob = exports.getJobsCalendar = exports.getJobs = void 0;
const client_1 = require("@prisma/client");
const eventBus_1 = require("../comms/eventBus");
const prisma = new client_1.PrismaClient();
const getJobs = async (req, reply) => {
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
        reply.send(jobs);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.getJobs = getJobs;
const getJobsCalendar = async (req, reply) => {
    try {
        const customerId = req.query.customerId;
        const whereClause = {
            scheduledStart: { not: null }
        };
        if (customerId) {
            whereClause.customerId = customerId;
        }
        const jobs = await prisma.job.findMany({
            where: whereClause,
            include: {
                customer: true,
                property: true,
            }
        });
        const calendarEvents = jobs.map(job => {
            let color = '#3b82f6'; // blue for scheduled/draft
            if (job.status === 'completed' || job.status === 'invoiced')
                color = '#10b981'; // green
            if (job.status === 'in_progress')
                color = '#f59e0b'; // amber
            if (job.status === 'cancelled')
                color = '#ef4444'; // red
            return {
                id: job.id,
                title: `${job.customer.name} - ${job.property.address}`,
                start: job.scheduledStart,
                end: job.scheduledEnd || new Date(job.scheduledStart.getTime() + 60 * 60 * 1000), // Default 1hr
                status: job.status,
                color
            };
        });
        reply.send(calendarEvents);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.getJobsCalendar = getJobsCalendar;
const createJob = async (req, reply) => {
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
        reply.status(201).json(newJob);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.createJob = createJob;
const updateJob = async (req, reply) => {
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
        if (technicianId !== undefined && technicianId !== null) {
            eventBus_1.eventBus.broadcast('job_assigned', updated);
        }
        reply.send(updated);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateJob = updateJob;
const clockIn = async (req, reply) => {
    try {
        const { id } = req.params;
        const { lat, lng } = req.body;
        const updated = await prisma.job.update({
            where: { id },
            data: {
                actualArrival: new Date(),
                status: 'in_progress'
            }
        });
        if (lat && lng && updated.technicianId) {
            await prisma.technician.update({
                where: { id: updated.technicianId },
                data: { currentLocationLat: lat, currentLocationLng: lng }
            });
        }
        reply.send(updated);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.clockIn = clockIn;
const clockOut = async (req, reply) => {
    try {
        const { id } = req.params;
        const job = await prisma.job.findUnique({ where: { id } });
        if (!job)
            return reply.status(404).json({ error: 'Job not found' });
        const actualDeparture = new Date();
        let onSiteTimeMinutes = 0;
        if (job.actualArrival) {
            const diffMs = actualDeparture.getTime() - job.actualArrival.getTime();
            onSiteTimeMinutes = Math.floor(diffMs / 60000);
        }
        const updated = await prisma.job.update({
            where: { id },
            data: {
                actualDeparture,
                onSiteTimeMinutes,
                status: 'completed'
            }
        });
        reply.send(updated);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.clockOut = clockOut;
