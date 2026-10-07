"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startPreVisitNotificationCron = startPreVisitNotificationCron;
const node_cron_1 = __importDefault(require("node-cron"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
function startPreVisitNotificationCron() {
    // Run every hour to check for upcoming jobs that are ~48 hours away
    node_cron_1.default.schedule('0 * * * *', async () => {
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
                    customer: true
                }
            });
            for (const job of upcomingJobs) {
                // Prevent duplicate notifications by checking if one exists
                const existingNotification = await prisma.notificationQueue.findFirst({
                    where: {
                        jobId: job.id,
                        type: 'pre_visit_reminder'
                    }
                });
                if (!existingNotification && job.customer) {
                    const contactTarget = job.customer.phone || job.customer.email || '';
                    const channel = job.customer.phone ? 'SMS' : 'EMAIL';
                    const scheduledTime = job.scheduledStart?.toLocaleString() || 'soon';
                    await prisma.notificationQueue.create({
                        data: {
                            customerId: job.customerId,
                            jobId: job.id,
                            type: 'pre_visit_reminder',
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
        }
        catch (error) {
            console.error('Error generating pre-visit notifications:', error);
        }
    });
}
