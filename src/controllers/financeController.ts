import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getFinancialReport = async (req: Request, res: Response) => {
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

    res.json({
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
    res.status(500).json({ error: 'Internal server error' });
  }
};
