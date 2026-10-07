"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateLocation = exports.getTechnicianSchedule = exports.getTechnicians = void 0;
const client_1 = require("@prisma/client");
const eventBus_1 = require("../comms/eventBus");
const prisma = new client_1.PrismaClient();
const getTechnicians = async (req, reply) => {
    try {
        const techs = await prisma.technician.findMany({
            include: { user: true }
        });
        reply.send(techs);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.getTechnicians = getTechnicians;
const getTechnicianSchedule = async (req, reply) => {
    try {
        const { id } = req.params;
        // For MVP, we'll fetch jobs assigned to the tech that are scheduled.
        // We could filter by today's date if needed, but we'll fetch all assigned non-completed jobs.
        const jobs = await prisma.job.findMany({
            where: {
                technicianId: id,
                status: { notIn: ['completed', 'cancelled'] }
            },
            include: {
                customer: true,
                property: true
            },
            orderBy: { scheduledStart: 'asc' }
        });
        reply.send(jobs);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.getTechnicianSchedule = getTechnicianSchedule;
const updateLocation = async (req, reply) => {
    try {
        const { id } = req.params;
        const { lat, lng } = req.body;
        const updated = await prisma.technician.update({
            where: { id },
            data: {
                currentLocationLat: lat,
                currentLocationLng: lng
            }
        });
        eventBus_1.eventBus.broadcast('tech_updated', updated);
        reply.send(updated);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateLocation = updateLocation;
