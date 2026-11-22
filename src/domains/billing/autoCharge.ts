import cron from '../../shared/scheduler';
import { PrismaClient } from '../../shared/database';
import { stripeService } from './stripeService';

const defaultPrisma = new PrismaClient();

export const processAutoCharges = async (prismaClient: any = defaultPrisma) => {
  console.log('Running auto-charge recurring contracts...');
  if (!prismaClient?.invoice?.findMany) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  const dueInvoices = await prismaClient.invoice.findMany({
    where: { status: 'unpaid' },
    include: { job: true },
  });

  let succeeded = 0;
  let failed = 0;

  for (const inv of dueInvoices || []) {
    try {
      const amountCents = Math.round(Number(inv.totalAmount || 0) * 100);
      if (amountCents <= 0) continue;

      const customerId = inv.customerId || inv.job?.customerId;
      const intent = await stripeService.createPaymentIntent(amountCents, 'usd', customerId || '');

      if (prismaClient.payment?.create && customerId) {
        await prismaClient.payment.create({
          data: {
            invoiceId: inv.id,
            customerId,
            amount: Number(inv.totalAmount),
            method: 'card',
            status: 'completed',
            externalTransactionId: intent?.id || `pi_auto_${inv.id}`,
          },
        });
      }

      if (prismaClient.invoice?.update) {
        await prismaClient.invoice.update({
          where: { id: inv.id },
          data: { status: 'paid' },
        });
      }
      succeeded++;
    } catch (err) {
      console.error(`Auto-charge failed for invoice ${inv.id}:`, err);
      failed++;
    }
  }

  return { processed: (dueInvoices || []).length, succeeded, failed };
};

export const startAutoChargeCron = () => {
  cron.schedule('0 0 * * *', async () => {
    await processAutoCharges();
  });
};
