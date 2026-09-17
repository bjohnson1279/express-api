import { Router } from 'express';
import { getFinancialReport, getInvoices, createInvoice, markInvoicePaid, createQuote, getQuotes, acceptQuote, recordPayment, triggerErpSync } from '../controllers/financeController';

const router = Router();
router.get('/report', getFinancialReport);
router.get('/invoices', getInvoices);
router.post('/invoices', createInvoice);
router.patch('/invoices/:id/status', markInvoicePaid);

router.get('/quotes', getQuotes);
router.post('/quotes', createQuote);
router.patch('/quotes/:id/accept', acceptQuote);

router.post('/payments', recordPayment);

router.post('/integrations/erp/sync', triggerErpSync);

export default router;
