"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggerErpSync = exports.recordPayment = exports.acceptQuote = exports.getQuotes = exports.createQuote = exports.markInvoicePaid = exports.createInvoice = exports.getInvoices = exports.getFinancialReport = void 0;
const client_1 = require("@prisma/client");
const erpIntegration_1 = require("./erpIntegration");
const prisma = new client_1.PrismaClient();
const getFinancialReport = async (req, reply) => {
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
        const commissions = await prisma.commission.findMany();
        const totalCommissions = commissions.reduce((sum, c) => sum + Number(c.amount), 0);
        const invoices = await prisma.invoice.findMany({
            include: { job: { include: { customer: true } } }
        });
        const outstandingInvoices = invoices.filter(i => i.status === 'unpaid');
        reply.send({
            mrr,
            arr: mrr * 12,
            totalCommissions,
            activeContractsCount: contracts.length,
            // Mocking invoices for the report if the DB has none generated yet
            outstandingInvoices: invoices.length > 0 ? outstandingInvoices : [
                { id: 'mock-1', totalAmount: 150.0, status: 'unpaid', job: { customer: { name: 'Residential Client (John Doe)' } }, createdAt: new Date() },
                { id: 'mock-2', totalAmount: 500.0, status: 'unpaid', job: { customer: { name: 'Commercial Client (Big Corp)' } }, createdAt: new Date() }
            ]
        });
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.getFinancialReport = getFinancialReport;
const getInvoices = async (req, reply) => {
    try {
        const invoices = await prisma.invoice.findMany({
            include: {
                job: {
                    include: { customer: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        reply.send(invoices);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.getInvoices = getInvoices;
const createInvoice = async (req, reply) => {
    try {
        const { jobId, totalAmount } = req.body;
        const invoice = await prisma.invoice.create({
            data: {
                jobId,
                totalAmount,
                status: 'unpaid'
            }
        });
        // Update job status to invoiced
        await prisma.job.update({
            where: { id: jobId },
            data: { status: 'invoiced' }
        });
        reply.status(201).json(invoice);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.createInvoice = createInvoice;
const markInvoicePaid = async (req, reply) => {
    try {
        const { id } = req.params;
        const invoice = await prisma.invoice.update({
            where: { id },
            data: { status: 'paid' },
            include: {
                job: {
                    include: { customer: true }
                }
            }
        });
        reply.send(invoice);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.markInvoicePaid = markInvoicePaid;
const createQuote = async (req, reply) => {
    try {
        const { customerId, propertyId, totalAmount } = req.body;
        const quote = await prisma.quote.create({
            data: {
                customerId,
                propertyId,
                totalAmount,
                status: 'draft'
            }
        });
        reply.status(201).json(quote);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.createQuote = createQuote;
const getQuotes = async (req, reply) => {
    try {
        const quotes = await prisma.quote.findMany({
            include: { customer: true, property: true },
            orderBy: { createdAt: 'desc' }
        });
        reply.send(quotes);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.getQuotes = getQuotes;
const eventBus_1 = require("../comms/eventBus");
const acceptQuote = async (req, reply) => {
    try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        const quote = await prisma.quote.update({
            where: { id },
            data: { status: 'accepted' },
            include: { customer: true }
        });
        // Automatically generate a corresponding Job for the accepted quote
        const newJob = await prisma.job.create({
            data: {
                tenantId: tenantId,
                customerId: quote.customerId,
                propertyId: quote.propertyId,
                status: 'draft'
            }
        });
        // Publish event
        eventBus_1.eventBus.broadcast('quote_accepted', { quote, job: newJob });
        reply.send({ quote, job: newJob });
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.acceptQuote = acceptQuote;
const recordPayment = async (req, reply) => {
    try {
        const { invoiceId, customerId, amount, method } = req.body;
        const payment = await prisma.payment.create({
            data: {
                invoiceId,
                customerId,
                amount,
                method,
                status: 'completed',
                externalTransactionId: `mock-txn-${Date.now()}`
            }
        });
        if (invoiceId) {
            await prisma.invoice.update({
                where: { id: invoiceId },
                data: { status: 'paid' }
            });
        }
        reply.status(201).json(payment);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.recordPayment = recordPayment;
const triggerErpSync = async (req, reply) => {
    try {
        const { provider, resourceId, resourceType, payload } = req.body;
        const log = await (0, erpIntegration_1.syncToErp)(provider, resourceId, resourceType, payload);
        reply.status(201).json(log);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.triggerErpSync = triggerErpSync;
