import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class HealthScoreService {
  async calculateForCustomer(customerId: string) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    });

    if (!customer) {
      throw new Error(`Customer with ID ${customerId} not found`);
    }

    let score = 100;
    const factors: Record<string, any> = {};

    // 1. Check unpaid invoices
    const unpaidInvoices = await prisma.invoice.count({
      where: {
        job: { customerId: customerId },
        status: 'unpaid'
      }
    });

    if (unpaidInvoices > 0) {
      const deduction = Math.min(unpaidInvoices * 15, 45); // Max 45 points deduction
      score -= deduction;
      factors['unpaidInvoices'] = { count: unpaidInvoices, deduction };
    }

    // 2. Check time since last job
    const lastJob = await prisma.job.findFirst({
      where: {
        customerId: customerId,
        status: 'completed'
      },
      orderBy: { scheduledStart: 'desc' }
    });

    if (lastJob && lastJob.scheduledStart) {
      const monthsSinceLastJob = (Date.now() - lastJob.scheduledStart.getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (monthsSinceLastJob > 12) {
        score -= 30;
        factors['inactivity'] = { monthsSinceLastJob: Math.round(monthsSinceLastJob), deduction: 30 };
      } else if (monthsSinceLastJob > 6) {
        score -= 15;
        factors['inactivity'] = { monthsSinceLastJob: Math.round(monthsSinceLastJob), deduction: 15 };
      }
    } else {
      score -= 10;
      factors['inactivity'] = { reason: 'no_completed_jobs', deduction: 10 };
    }

    // Ensure score is between 0 and 100
    score = Math.max(0, Math.min(100, score));

    // Determine risk level
    let riskLevel = 'low';
    if (score <= 50) {
      riskLevel = 'high';
    } else if (score <= 80) {
      riskLevel = 'medium';
    }

    // Save to database
    const healthScore = await prisma.customerHealthScore.upsert({
      where: { customerId: customerId },
      update: {
        score,
        riskLevel,
        factors,
        calculatedAt: new Date()
      },
      create: {
        customerId,
        score,
        riskLevel,
        factors,
        calculatedAt: new Date()
      }
    });

    return healthScore;
  }

  async calculateForAllCustomers() {
    console.log('Starting health score calculation for all customers...');
    const customers = await prisma.customer.findMany({
      select: { id: true }
    });

    let successCount = 0;
    let errorCount = 0;

    for (const customer of customers) {
      try {
        await this.calculateForCustomer(customer.id);
        successCount++;
      } catch (error) {
        console.error(`Error calculating health score for customer ${customer.id}:`, error);
        errorCount++;
      }
    }

    console.log(`Finished health score calculation. Success: ${successCount}, Errors: ${errorCount}`);
  }
}
