"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBooking = exports.getAvailableSlots = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// GET /api/v1/booking/slots?date=YYYY-MM-DD
const getAvailableSlots = async (req, reply) => {
    try {
        const { date } = req.query;
        if (!date)
            return reply.status(400).json({ error: 'Date is required' });
        // Mock slots for now. In a real application, we'd query Jobs 
        // for this date and ensure we have at least one Technician without overlap.
        const slots = ["08:00", "10:00", "12:00", "14:00"];
        const result = slots.map(time => ({ time, available: true }));
        reply.send(result);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.getAvailableSlots = getAvailableSlots;
// POST /api/v1/booking
const createBooking = async (req, reply) => {
    try {
        const { tenantId, customerId, propertyId, date, time } = req.body;
        if (!tenantId || !customerId || !propertyId || !date || !time) {
            return reply.status(400).json({ error: 'Missing required booking fields' });
        }
        const startDt = new Date(`${date}T${time}:00Z`);
        const endDt = new Date(startDt.getTime() + 2 * 60 * 60 * 1000); // Assume 2-hour jobs
        const job = await prisma.job.create({
            data: {
                tenantId,
                customerId,
                propertyId,
                status: 'scheduled',
                scheduledStart: startDt,
                scheduledEnd: endDt
            }
        });
        reply.status(201).json(job);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.createBooking = createBooking;
