import cron from 'node-cron';
import { PrismaClient, ContractCadence } from '@prisma/client';

const prisma = new PrismaClient();

export function startJobGenerationCron() {
  // Run daily at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('Running daily job generation cron...');
    try {
      const activeContracts = await prisma.serviceContract.findMany({
        where: { status: 'active' },
        include: { customer: true },
      });

      const now = new Date();
      // Generate jobs for the next 30 days if they don't exist
      const horizonDate = new Date();
      horizonDate.setDate(now.getDate() + 30);

      for (const contract of activeContracts) {
        // Calculate the next date based on cadence and start date
        // Simplified calculation for this task
        let nextServiceDate = new Date(contract.startDate);
        while (nextServiceDate < now) {
          switch (contract.cadence) {
            case ContractCadence.MONTHLY:
              nextServiceDate.setMonth(nextServiceDate.getMonth() + 1);
              break;
            case ContractCadence.BI_MONTHLY:
              nextServiceDate.setMonth(nextServiceDate.getMonth() + 2);
              break;
            case ContractCadence.QUARTERLY:
              nextServiceDate.setMonth(nextServiceDate.getMonth() + 3);
              break;
            case ContractCadence.SEMI_ANNUALLY:
              nextServiceDate.setMonth(nextServiceDate.getMonth() + 6);
              break;
            case ContractCadence.ANNUALLY:
              nextServiceDate.setFullYear(nextServiceDate.getFullYear() + 1);
              break;
            case ContractCadence.ONE_TIME:
            default:
              nextServiceDate.setFullYear(nextServiceDate.getFullYear() + 99); // won't trigger
              break;
          }
        }

        if (nextServiceDate <= horizonDate) {
          const startOfDay = new Date(nextServiceDate);
          startOfDay.setHours(0, 0, 0, 0);
          
          const endOfDay = new Date(nextServiceDate);
          endOfDay.setHours(23, 59, 59, 999);

          const existingJob = await prisma.job.findFirst({
            where: {
              contractId: contract.id,
              scheduledStart: {
                gte: startOfDay,
                lte: endOfDay,
              },
            },
          });

          if (!existingJob) {
            const newJob = await prisma.job.create({
              data: {
                tenantId: contract.tenantId,
                customerId: contract.customerId,
                propertyId: contract.propertyId,
                contractId: contract.id,
                status: 'scheduled',
                scheduledStart: startOfDay,
              },
            });

            const emailTarget = await prisma.customerEmail.findFirst({
              where: { customerId: contract.customerId, isPrimary: true },
            });
            const contactTarget = emailTarget ? emailTarget.emailAddress : contract.customer.name;

            await prisma.notificationQueue.create({
              data: {
                tenantId: contract.tenantId,
                customerId: contract.customerId,
                jobId: newJob.id,
                channel: 'EMAIL',
                contactTarget: contactTarget,
                messageContent: `A new service job has been scheduled for ${startOfDay.toDateString()}`,
                status: 'pending',
                scheduledFor: now,
              },
            });
            console.log(`Generated job ${newJob.id} for contract ${contract.id}`);
          }
        }
      }
    } catch (error) {
      console.error('Error in job generation cron:', error);
    }
  });
}
