import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export function startPreVisitNotificationCron() {
  // Run every hour to check for upcoming jobs that are ~48 hours away
  cron.schedule('0 * * * *', async () => {
    console.log('Running pre-visit notification generator...');
    try {
      const now = new Date();
      const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      const in49Hours = new Date(now.getTime() + 49 * 60 * 60 * 1000);

      // Find scheduled jobs starting between 48 and 49 hours from now
      const upcomingJobs = await prisma.job.findMany({
        where: {
          status: 'scheduled',
          scheduledStart: {
            gte: in48Hours,
            lt: in49Hours
          }
        },
        include: {
          customer: { include: { phones: { orderBy: { isPrimary: 'desc' } }, emails: { orderBy: { isPrimary: 'desc' } } } }
        }
      });

      for (const job of upcomingJobs) {
        // Prevent duplicate notifications by checking if one exists
        const existingNotification = await prisma.notificationQueue.findFirst({
          where: {
            jobId: job.id,
            tenantId: job.tenantId,
            messageContent: { startsWith: 'Reminder: You have an upcoming service appointment scheduled for ' }
          }
        });

        if (!existingNotification && job.customer) {
          const phone = job.customer.phones.find(contact => contact.receivesSms && contact.phoneNumber);
          const email = job.customer.emails.find(contact => contact.emailAddress);
          const contactTarget = phone?.phoneNumber || email?.emailAddress;
          if (!contactTarget) continue;
          const channel = phone ? 'SMS' : 'EMAIL';
          const scheduledTime = job.scheduledStart?.toLocaleString() || 'soon';

          await prisma.notificationQueue.create({
            data: {
              customerId: job.customerId,
              jobId: job.id,
              tenantId: job.tenantId,
              channel: channel,
              contactTarget: contactTarget,
              messageContent: `Reminder: You have an upcoming service appointment scheduled for ${scheduledTime}.`,
              status: 'pending',
              scheduledFor: new Date() // Send it immediately once we hit this 48hr window
            }
          });
          console.log(`Created pre-visit reminder for Job ${job.id}`);
        }
      }
    } catch (error) {
      console.error('Error generating pre-visit notifications:', error);
    }
  });
}
