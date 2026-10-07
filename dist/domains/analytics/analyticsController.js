"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportReport = exports.getLaborCosts = exports.recalculatePestRisks = exports.getPestRiskHeatmap = exports.getPropertyPestRisk = exports.getClimateMetrics = exports.getDashboardAnalytics = void 0;
const client_1 = require("@prisma/client");
const pdfkit_1 = __importDefault(require("pdfkit"));
const prisma = new client_1.PrismaClient();
const getDashboardAnalytics = async (req, reply) => {
    try {
        const contracts = await prisma.serviceContract.findMany({
            where: { status: 'active' }
        });
        // Approximate MRR (Monthly Recurring Revenue)
        let mrr = 0;
        contracts.forEach(c => {
            const amt = Number(c.recurringAmount || 0);
            switch (c.cadence) {
                case 'MONTHLY':
                    mrr += amt;
                    break;
                case 'QUARTERLY':
                    mrr += (amt / 3);
                    break;
                case 'SEMI_ANNUALLY':
                    mrr += (amt / 6);
                    break;
                case 'ANNUALLY':
                    mrr += (amt / 12);
                    break;
                case 'BI_MONTHLY':
                    mrr += (amt / 2);
                    break;
            }
        });
        const commissions = await prisma.commission.findMany({
            include: { salesRep: true }
        });
        const totalCommissions = commissions.reduce((sum, c) => sum + Number(c.amount), 0);
        const invoices = await prisma.invoice.findMany();
        const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + Number(i.totalAmount), 0);
        // Calculate jobs completed by technician for leaderboard
        const completedJobs = await prisma.job.findMany({
            where: { status: 'completed' },
            include: { technician: { include: { user: true } } }
        });
        const techLeaderboard = {};
        completedJobs.forEach(job => {
            if (job.technician && job.technician.user) {
                const id = job.technician.id;
                if (!techLeaderboard[id])
                    techLeaderboard[id] = { name: job.technician.user.email, count: 0 };
                techLeaderboard[id].count += 1;
            }
        });
        // Sales Rep leaderboard by commissions
        const salesLeaderboard = {};
        commissions.forEach(c => {
            if (c.salesRep) {
                const id = c.salesRepId;
                if (!salesLeaderboard[id])
                    salesLeaderboard[id] = { name: c.salesRep.email, revenue: 0 };
                salesLeaderboard[id].revenue += Number(c.amount);
            }
        });
        reply.send({
            mrr,
            arr: mrr * 12,
            totalCommissions,
            totalRevenue,
            activeContractsCount: contracts.length,
            techLeaderboard: Object.values(techLeaderboard).sort((a, b) => b.count - a.count).slice(0, 5),
            salesLeaderboard: Object.values(salesLeaderboard).sort((a, b) => b.revenue - a.revenue).slice(0, 5)
        });
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.getDashboardAnalytics = getDashboardAnalytics;
const PestRiskService_1 = require("./PestRiskService");
const ClimateService_1 = require("./ClimateService");
const getClimateMetrics = async (req, reply) => {
    try {
        const lat = req.query.lat ? parseFloat(String(req.query.lat)) : 39.7817;
        const lng = req.query.lng ? parseFloat(String(req.query.lng)) : -89.6501;
        const climate = await ClimateService_1.ClimateService.getClimateData(lat, lng);
        reply.send(climate);
    }
    catch (error) {
        console.error('Error fetching climate data:', error);
        reply.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.getClimateMetrics = getClimateMetrics;
const getPropertyPestRisk = async (req, reply) => {
    try {
        const { propertyId } = req.params;
        const tenantId = req.tenantId || req.headers['x-tenant-id'] || '3fa85f64-5717-4562-b3fc-2c963f66afa6';
        const prediction = await PestRiskService_1.PestRiskService.calculatePropertyRisk(propertyId, String(tenantId));
        reply.send(prediction);
    }
    catch (error) {
        console.error('Error calculating pest risk:', error);
        reply.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.getPropertyPestRisk = getPropertyPestRisk;
const getPestRiskHeatmap = async (req, reply) => {
    try {
        const tenantId = req.tenantId || req.headers['x-tenant-id'] || '3fa85f64-5717-4562-b3fc-2c963f66afa6';
        const heatmap = await PestRiskService_1.PestRiskService.getHeatmapData(String(tenantId));
        reply.send(heatmap);
    }
    catch (error) {
        console.error('Error fetching pest risk heatmap:', error);
        reply.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.getPestRiskHeatmap = getPestRiskHeatmap;
const recalculatePestRisks = async (req, reply) => {
    try {
        const tenantId = req.tenantId || req.headers['x-tenant-id'] || '3fa85f64-5717-4562-b3fc-2c963f66afa6';
        const heatmap = await PestRiskService_1.PestRiskService.getHeatmapData(String(tenantId));
        reply.send({ success: true, count: heatmap.length, records: heatmap });
    }
    catch (error) {
        console.error('Error recalculating pest risks:', error);
        reply.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.recalculatePestRisks = recalculatePestRisks;
const getLaborCosts = async (req, reply) => {
    try {
        const jobs = await prisma.job.findMany({
            where: { status: 'completed', onSiteTimeMinutes: { not: null } },
            include: { technician: { include: { user: true } } }
        });
        const laborAnalytics = {};
        jobs.forEach(job => {
            if (job.technician && job.technician.user) {
                const id = job.technician.id;
                if (!laborAnalytics[id]) {
                    laborAnalytics[id] = { technician: job.technician.user.email, totalOnSiteMinutes: 0, totalDriveMinutes: 0, jobsCount: 0 };
                }
                laborAnalytics[id].totalOnSiteMinutes += job.onSiteTimeMinutes || 0;
                laborAnalytics[id].totalDriveMinutes += job.driveTimeMinutes || 0;
                laborAnalytics[id].jobsCount += 1;
            }
        });
        reply.send(Object.values(laborAnalytics));
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.getLaborCosts = getLaborCosts;
const json2csv_1 = require("json2csv");
const exportReport = async (req, reply) => {
    try {
        const { format = 'csv', type = 'revenue' } = req.query;
        let data = [];
        if (type === 'productivity') {
            const jobs = await prisma.job.findMany({ include: { technician: { include: { user: true } } } });
            const stats = {};
            jobs.forEach(j => {
                if (j.technician?.user) {
                    const email = j.technician.user.email;
                    if (!stats[email])
                        stats[email] = { Technician: email, Completed: 0, TotalOnSiteMinutes: 0 };
                    if (j.status === 'completed') {
                        stats[email].Completed += 1;
                        stats[email].TotalOnSiteMinutes += j.onSiteTimeMinutes || 0;
                    }
                }
            });
            data = Object.values(stats);
        }
        else if (type === 'revenue') {
            const invoices = await prisma.invoice.findMany({ include: { job: { include: { customer: true } } } });
            data = invoices.map(i => ({
                InvoiceID: i.id,
                Status: i.status,
                Customer: i.job?.customer?.name || 'Unknown',
                Amount: i.totalAmount
            }));
        }
        else if (type === 'chemicals') {
            const usage = await prisma.materialUsage.findMany({ include: { inventoryItem: true, job: { include: { customer: true } } } });
            data = usage.map(u => ({
                Chemical: u.inventoryItem?.name || 'Unknown',
                Quantity: u.quantity,
                Status: u.status,
                Customer: u.job?.customer?.name || 'Unknown'
            }));
        }
        else {
            return reply.status(400).json({ error: 'Unsupported report type. Use revenue, productivity, or chemicals.' });
        }
        if (data.length === 0) {
            data = [{ Message: 'No data available for this report type.' }];
        }
        if (format === 'csv') {
            const json2csvParser = new json2csv_1.Parser();
            const csv = json2csvParser.parse(data);
            reply.header('Content-Type', 'text/csv');
            reply.attachment(`${type}-report.csv`);
            return reply.send(csv);
        }
        else if (format === 'pdf') {
            const doc = new pdfkit_1.default();
            reply.header('Content-Type', 'application/pdf');
            reply.attachment(`${type}-report.pdf`);
            doc.pipe(res);
            doc.fontSize(20).text(`${String(type).toUpperCase()} REPORT`, { align: 'center' });
            doc.moveDown();
            data.forEach(item => {
                doc.fontSize(10).text(JSON.stringify(item, null, 2));
                doc.moveDown();
            });
            doc.end();
        }
        else {
            reply.status(400).json({ error: 'Unsupported format type. Use csv or pdf' });
        }
    }
    catch (error) {
        console.error('Error generating report:', error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.exportReport = exportReport;
