"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleFollowup = exports.createCampaign = exports.getCampaigns = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getCampaigns = async (req, reply) => {
    try {
        const tenantId = req.user?.tenantId;
        const campaigns = await prisma.campaign.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' }
        });
        reply.send(campaigns);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.getCampaigns = getCampaigns;
const createCampaign = async (req, reply) => {
    try {
        const tenantId = req.user?.tenantId;
        const { name, startDate, endDate, budget } = req.body;
        const campaign = await prisma.campaign.create({
            data: {
                tenantId,
                name,
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
                budget: budget ? parseFloat(budget) : null,
                status: 'draft',
            }
        });
        reply.status(201).json(campaign);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.createCampaign = createCampaign;
const scheduleFollowup = async (req, reply) => {
    try {
        const tenantId = req.user?.tenantId;
        const { customerId, campaignId, sequenceType, scheduledDate } = req.body;
        const followup = await prisma.automatedFollowup.create({
            data: {
                tenantId,
                customerId,
                campaignId,
                sequenceType,
                scheduledDate: new Date(scheduledDate),
            }
        });
        reply.status(201).json(followup);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.scheduleFollowup = scheduleFollowup;
