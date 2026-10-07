import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthRequest } from '../../shared/middleware/authMiddleware';
import { PrismaClient } from '@prisma/client';
import { syncToErp } from './erpIntegration';

const prisma = new PrismaClient();

export const getFinancialReport = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const contracts = await prisma.serviceContract.findMany({
      where: { status: 'active' }
    });
    
    // Approximate MRR (Monthly Recurring Revenue)
    let mrr = 0;
    contracts.forEach(c => {
      const amt = Number(c.recurringAmount || 0);
      switch(c.cadence) {
        case 'MONTHLY': mrr += amt; break;
        case 'QUARTERLY': mrr += (amt / 3); break;
        case 'SEMI_ANNUALLY': mrr += (amt / 6); break;
        case 'ANNUALLY': mrr += (amt / 12); break;
        case 'BI_MONTHLY': mrr += (amt / 2); break;
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
  } catch (error) {
    console.error(error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};

export const getInvoices = async (req: FastifyRequest, reply: FastifyReply) => {
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
  } catch (error) {
    console.error(error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};

export const createInvoice = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { jobId, totalAmount } = (req.body as any);
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
    reply.status(201).send(invoice);
  } catch (error) {
    console.error(error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};

export const markInvoicePaid = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = (req.params as any);
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
  } catch (error) {
    console.error(error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};

export const createQuote = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { customerId, propertyId, totalAmount } = (req.body as any);
    const quote = await prisma.quote.create({
      data: {
        customerId,
        propertyId,
        totalAmount,
        status: 'draft'
      }
    });
    reply.status(201).send(quote);
  } catch (error) {
    console.error(error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};

export const getQuotes = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const quotes = await prisma.quote.findMany({
      include: { customer: true, property: true },
      orderBy: { createdAt: 'desc' }
    });
    reply.send(quotes);
  } catch (error) {
    console.error(error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};

import { eventBus } from '../comms/eventBus';

export const acceptQuote = async (req: AuthRequest, reply: FastifyReply) => {
  try {
    const { id } = (req.params as any);
    const tenantId = req.user?.tenantId!;
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
    eventBus.broadcast('quote_accepted', { quote, job: newJob });

    reply.send({ quote, job: newJob });
  } catch (error) {
    console.error(error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};

export const recordPayment = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { invoiceId, customerId, amount, method } = (req.body as any);
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
    reply.status(201).send(payment);
  } catch (error) {
    console.error(error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};

export const triggerErpSync = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { provider, resourceId, resourceType, payload } = (req.body as any);
    const log = await syncToErp(provider, resourceId, resourceType, payload);
    reply.status(201).send(log);
  } catch (error) {
    console.error(error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};
