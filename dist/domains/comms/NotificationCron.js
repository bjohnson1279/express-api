"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startNotificationCron = startNotificationCron;
const node_cron_1 = __importDefault(require("node-cron"));
const client_1 = require("@prisma/client");
const NotificationService_1 = require("./NotificationService");
const prisma = new client_1.PrismaClient();
const notificationService = new NotificationService_1.NotificationService();
function startNotificationCron() {
    // Run every minute
    node_cron_1.default.schedule('* * * * *', async () => {
        console.log('Running notification queue processor...');
        try {
            const pendingNotifications = await prisma.notificationQueue.findMany({
                where: {
                    status: 'pending',
                    scheduledFor: {
                        lte: new Date() // Only process past or present scheduled notifications
                    }
                },
                take: 50 // Process in batches to avoid overwhelming the system
            });
            for (const notification of pendingNotifications) {
                // Mark as processing to avoid duplicate processing if cron overlaps
                await prisma.notificationQueue.update({
                    where: { id: notification.id },
                    data: { status: 'processing' }
                });
                let success = false;
                let errorLog = null;
                try {
                    // Check Customer Preferences first
                    const prefs = await prisma.notificationPreference.findUnique({
                        where: { customerId: notification.customerId }
                    });
                    // Default is true if no record exists
                    const smsEnabled = prefs?.smsEnabled ?? true;
                    const emailEnabled = prefs?.emailEnabled ?? true;
                    const voiceEnabled = prefs?.voiceEnabled ?? false;
                    let skipped = false;
                    if (notification.channel === 'SMS') {
                        if (smsEnabled) {
                            await notificationService.sendSMS(notification.contactTarget, notification.messageContent);
                        }
                        else {
                            skipped = true;
                        }
                    }
                    else if (notification.channel === 'VOICE') {
                        if (voiceEnabled) {
                            await notificationService.sendRobocall(notification.contactTarget, notification.messageContent);
                        }
                        else {
                            skipped = true;
                        }
                    }
                    else if (notification.channel === 'EMAIL') {
                        if (emailEnabled) {
                            await notificationService.sendEmail(notification.contactTarget, 'Servicing CRM Update', notification.messageContent);
                        }
                        else {
                            skipped = true;
                        }
                    }
                    if (skipped) {
                        errorLog = 'Opted out';
                        success = true; // Mark success but note they opted out
                    }
                    else {
                        success = true;
                    }
                }
                catch (err) {
                    errorLog = err.message;
                }
                // Update final status
                await prisma.notificationQueue.update({
                    where: { id: notification.id },
                    data: {
                        status: (success && errorLog === 'Opted out') ? 'skipped' : (success ? 'completed' : 'failed'),
                        processedAt: new Date(),
                        errorLog
                    }
                });
            }
        }
        catch (error) {
            console.error('Error in notification cron:', error);
        }
    });
}
