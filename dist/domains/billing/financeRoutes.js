"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const financeController_1 = require("./financeController");
const routes = async (fastify, opts) => {
    fastify.get('/report', financeController_1.getFinancialReport);
    fastify.get('/invoices', financeController_1.getInvoices);
    fastify.post('/invoices', financeController_1.createInvoice);
    fastify.patch('/invoices/:id/status', financeController_1.markInvoicePaid);
    fastify.get('/quotes', financeController_1.getQuotes);
    fastify.post('/quotes', financeController_1.createQuote);
    fastify.patch('/quotes/:id/accept', financeController_1.acceptQuote);
    fastify.post('/payments', financeController_1.recordPayment);
    fastify.post('/integrations/erp/sync', financeController_1.triggerErpSync);
};
exports.default = routes;
