import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { NotificationService } from '../comms/NotificationService';

const prisma = new PrismaClient();
const notificationService = new NotificationService();

export function startFollowUpCron() {
  // Run daily at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('Running automated follow-ups cron...');
    try {
      const now = new Date();
      const pendingFollowups = await prisma.automatedFollowup.findMany({
        where: {
          sentStatus: 'pending',
          scheduledDate: {
            lte: now, // anything scheduled for now or in the past
          }
        },
        include: {
          customer: true,
          campaign: true,
        }
      });

      for (const followup of pendingFollowups) {
        try {
          const emailTarget = await prisma.customerEmail.findFirst({
            where: { customerId: followup.customerId, isPrimary: true }
          });
          
          if (emailTarget) {
            await notificationService.sendEmail(
              emailTarget.emailAddress,
              `Follow up from ${followup.campaign?.name || 'us'}`,
              `Hello ${followup.customer.name},\n\nWe wanted to follow up regarding your recent service. \n\nBest regards,\nYour Servicing Team`
            );
            
            await prisma.automatedFollowup.update({
              where: { id: followup.id },
              data: { sentStatus: 'sent' }
            });
            console.log(`Sent follow-up ${followup.id} to ${emailTarget.emailAddress}`);
          } else {
             // Mark as failed if no email
             await prisma.automatedFollowup.update({
              where: { id: followup.id },
              data: { sentStatus: 'failed' }
            });
          }
        } catch (innerError) {
          console.error(`Failed to process follow-up ${followup.id}`, innerError);
          await prisma.automatedFollowup.update({
            where: { id: followup.id },
            data: { sentStatus: 'failed' }
          });
        }
      }
    } catch (error) {
      console.error('Error in automated follow-ups cron:', error);
    }
  });
}
