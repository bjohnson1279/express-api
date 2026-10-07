import { FastifyPluginAsync } from 'fastify';
import { getFinancialReport, getInvoices, createInvoice, markInvoicePaid, createQuote, getQuotes, acceptQuote, recordPayment, triggerErpSync } from './financeController';

const routes: FastifyPluginAsync = async (fastify, opts) => {
fastify.get('/report', getFinancialReport);
fastify.get('/invoices', getInvoices);
fastify.post('/invoices', createInvoice);
fastify.patch('/invoices/:id/status', markInvoicePaid);

fastify.get('/quotes', getQuotes);
fastify.post('/quotes', createQuote);
fastify.patch('/quotes/:id/accept', acceptQuote);

fastify.post('/payments', recordPayment);

fastify.post('/integrations/erp/sync', triggerErpSync);

};

export default routes;
