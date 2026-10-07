"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.npsDashboard = exports.listSurveys = exports.getSurvey = exports.submitResponse = exports.createSurvey = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// POST /api/v1/surveys — Create and send a survey after service
const createSurvey = async (req, reply) => {
    try {
        const { tenantId, customerId, jobId, technicianId } = req.body;
        const survey = await prisma.survey.create({
            data: {
                tenantId,
                customerId,
                jobId: jobId || null,
                technicianId: technicianId || null,
                status: 'sent',
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            }
        });
        // Queue an SMS/Email notification with the survey link
        const customer = await prisma.customer.findUnique({
            where: { id: customerId },
            include: { user: true, phones: true, emails: true }
        });
        if (customer) {
            const surveyUrl = `${process.env.CUSTOMER_PORTAL_URL || 'http://localhost:3001'}/surveys/${survey.id}`;
            // Queue SMS if phone available
            const phone = customer.phones?.[0];
            if (phone) {
                await prisma.notificationQueue.create({
                    data: {
                        tenantId,
                        customerId,
                        jobId: jobId || null,
                        channel: 'SMS',
                        contactTarget: phone.phoneNumber,
                        messageContent: `How was your recent service? Rate us and leave feedback: ${surveyUrl}`,
                    }
                });
            }
            // Queue Email
            const email = customer.emails?.[0] || customer.user;
            if (email) {
                await prisma.notificationQueue.create({
                    data: {
                        tenantId,
                        customerId,
                        jobId: jobId || null,
                        channel: 'EMAIL',
                        contactTarget: email.email || email.emailAddress,
                        messageContent: `We'd love your feedback! Please take a moment to rate your recent service visit: ${surveyUrl}`,
                    }
                });
            }
        }
        reply.status(201).json(survey);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.createSurvey = createSurvey;
// POST /api/v1/surveys/:id/respond — Submit a survey response (customer-facing)
const submitResponse = async (req, reply) => {
    try {
        const { id } = req.params;
        const { npsScore, comments } = req.body;
        // Validate NPS score
        if (npsScore === undefined || npsScore === null || npsScore < 0 || npsScore > 10) {
            return reply.status(400).json({ error: 'NPS score must be between 0 and 10' });
        }
        // Check survey exists and isn't already responded
        const survey = await prisma.survey.findUnique({ where: { id }, include: { response: true } });
        if (!survey)
            return reply.status(404).json({ error: 'Survey not found' });
        if (survey.response)
            return reply.status(409).json({ error: 'Survey already responded' });
        if (survey.expiresAt && new Date() > survey.expiresAt) {
            return reply.status(410).json({ error: 'Survey has expired' });
        }
        const response = await prisma.surveyResponse.create({
            data: {
                surveyId: id,
                npsScore,
                comments: comments || null,
            }
        });
        // Update survey status
        await prisma.survey.update({
            where: { id },
            data: { status: 'completed' }
        });
        reply.status(201).json(response);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.submitResponse = submitResponse;
// GET /api/v1/surveys/:id — Get a single survey (for the customer response form)
const getSurvey = async (req, reply) => {
    try {
        const { id } = req.params;
        const survey = await prisma.survey.findUnique({
            where: { id },
            include: {
                response: true,
                customer: { select: { name: true } },
                technician: { select: { user: { select: { firstName: true, lastName: true } } } },
                job: { select: { scheduledStart: true, status: true } }
            }
        });
        if (!survey)
            return reply.status(404).json({ error: 'Survey not found' });
        reply.send(survey);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.getSurvey = getSurvey;
// GET /api/v1/surveys — List all surveys (admin)
const listSurveys = async (req, reply) => {
    try {
        const surveys = await prisma.survey.findMany({
            include: {
                response: true,
                customer: { select: { name: true } },
                technician: { select: { user: { select: { firstName: true, lastName: true } } } },
            },
            orderBy: { sentAt: 'desc' },
            take: 100
        });
        reply.send(surveys);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.listSurveys = listSurveys;
// GET /api/v1/surveys/nps-dashboard — Aggregate NPS metrics
const npsDashboard = async (req, reply) => {
    try {
        const responses = await prisma.surveyResponse.findMany({
            include: {
                survey: {
                    include: {
                        customer: { select: { name: true } },
                        technician: { select: { id: true, user: { select: { firstName: true, lastName: true } } } }
                    }
                }
            },
            orderBy: { respondedAt: 'desc' }
        });
        const scores = responses.filter((r) => r.npsScore !== null).map((r) => r.npsScore);
        const total = scores.length;
        const promoters = scores.filter((s) => s >= 9).length;
        const passives = scores.filter((s) => s >= 7 && s <= 8).length;
        const detractors = scores.filter((s) => s <= 6).length;
        const npsScore = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0;
        const avgScore = total > 0 ? (scores.reduce((a, b) => a + b, 0) / total).toFixed(1) : '0.0';
        // Per-technician breakdown
        const techMap = new Map();
        for (const r of responses) {
            const tech = r.survey?.technician;
            if (tech && r.npsScore !== null) {
                const key = tech.id;
                if (!techMap.has(key)) {
                    techMap.set(key, { name: `${tech.user.firstName} ${tech.user.lastName}`, scores: [] });
                }
                techMap.get(key).scores.push(r.npsScore);
            }
        }
        const technicianScores = Array.from(techMap.entries()).map(([id, data]) => {
            const avg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
            return { technicianId: id, name: data.name, avgScore: Number(avg.toFixed(1)), count: data.scores.length };
        }).sort((a, b) => b.avgScore - a.avgScore);
        // Recent responses with comments
        const recentFeedback = responses
            .filter((r) => r.comments)
            .slice(0, 10)
            .map((r) => ({
            score: r.npsScore,
            comments: r.comments,
            customerName: r.survey?.customer?.name,
            technicianName: r.survey?.technician ? `${r.survey.technician.user.firstName} ${r.survey.technician.user.lastName}` : null,
            respondedAt: r.respondedAt
        }));
        reply.send({
            npsScore,
            avgScore: Number(avgScore),
            total,
            promoters,
            passives,
            detractors,
            technicianScores,
            recentFeedback
        });
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.npsDashboard = npsDashboard;
