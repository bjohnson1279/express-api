"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startInventoryCron = startInventoryCron;
const node_cron_1 = __importDefault(require("node-cron"));
const client_1 = require("@prisma/client");
const NotificationService_1 = require("../comms/NotificationService");
const prisma = new client_1.PrismaClient();
const notificationService = new NotificationService_1.NotificationService();
function startInventoryCron() {
    // Run daily at 6:00 AM
    node_cron_1.default.schedule('0 6 * * *', async () => {
        console.log('Running low stock inventory cron...');
        try {
            // Fetch all items (or implement a raw query for column comparison)
            const allItems = await prisma.inventoryItem.findMany({
                include: { tenant: true }
            });
            const lowStockItems = allItems.filter(item => item.quantity <= item.minimumThreshold);
            for (const item of lowStockItems) {
                // Auto-draft a purchase order if one doesn't exist recently
                const existingPo = await prisma.purchaseOrder.findFirst({
                    where: {
                        itemId: item.id,
                        status: { in: ['draft', 'ordered'] }
                    }
                });
                if (!existingPo) {
                    const suggestedQuantity = Math.max(item.minimumThreshold * 2, 10);
                    await prisma.purchaseOrder.create({
                        data: {
                            tenantId: item.tenantId,
                            itemId: item.id,
                            quantity: suggestedQuantity,
                            status: 'draft',
                        }
                    });
                    // Optional: Send alert to admin
                    // Assuming tenant has a main admin email or we find a user with SUPER_ADMIN role
                    const adminUsers = await prisma.user.findMany({
                        where: { tenantId: item.tenantId, role: 'SUPER_ADMIN' }
                    });
                    for (const admin of adminUsers) {
                        await notificationService.sendEmail(admin.email, `Low Stock Alert: ${item.name}`, `The inventory for ${item.name} (SKU: ${item.sku}) has fallen to ${item.quantity}. A draft purchase order for ${suggestedQuantity} units has been created.`);
                    }
                }
            }
        }
        catch (error) {
            console.error('Error in inventory cron:', error);
        }
    });
}
