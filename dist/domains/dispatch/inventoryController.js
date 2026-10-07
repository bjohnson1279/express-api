"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEpaComplianceReport = exports.recordChemicalApplication = exports.createPurchaseOrder = exports.getPurchaseOrders = exports.updateInventoryQuantity = exports.createInventoryItem = exports.getInventoryItems = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getInventoryItems = async (req, reply) => {
    try {
        const tenantId = req.user?.tenantId;
        const items = await prisma.inventoryItem.findMany({
            where: { tenantId },
            orderBy: { name: 'asc' }
        });
        reply.send(items);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.getInventoryItems = getInventoryItems;
const createInventoryItem = async (req, reply) => {
    try {
        const tenantId = req.user?.tenantId;
        const { name, sku, quantity, minimumThreshold, unitCost, location } = req.body;
        const item = await prisma.inventoryItem.create({
            data: {
                tenantId,
                name,
                sku,
                quantity: parseInt(quantity) || 0,
                minimumThreshold: parseInt(minimumThreshold) || 10,
                unitCost: unitCost ? parseFloat(unitCost) : null,
                location,
            }
        });
        reply.status(201).json(item);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.createInventoryItem = createInventoryItem;
const updateInventoryQuantity = async (req, reply) => {
    try {
        const { id } = req.params;
        const { quantityDelta } = req.body; // positive to add, negative to consume
        const item = await prisma.inventoryItem.update({
            where: { id },
            data: {
                quantity: { increment: parseInt(quantityDelta) }
            }
        });
        reply.send(item);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateInventoryQuantity = updateInventoryQuantity;
const getPurchaseOrders = async (req, reply) => {
    try {
        const tenantId = req.user?.tenantId;
        const pos = await prisma.purchaseOrder.findMany({
            where: { tenantId },
            include: { item: true },
            orderBy: { createdAt: 'desc' }
        });
        reply.send(pos);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.getPurchaseOrders = getPurchaseOrders;
const createPurchaseOrder = async (req, reply) => {
    try {
        const tenantId = req.user?.tenantId;
        const { itemId, quantity, expectedDeliveryDate } = req.body;
        const po = await prisma.purchaseOrder.create({
            data: {
                tenantId,
                itemId,
                quantity: parseInt(quantity),
                expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
            },
            include: { item: true }
        });
        reply.status(201).json(po);
    }
    catch (error) {
        console.error(error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.createPurchaseOrder = createPurchaseOrder;
// Chemical Application Tracking with Inventory Auto-Deduction
const recordChemicalApplication = async (req, reply) => {
    try {
        const tenantId = req.user?.tenantId;
        const { jobId, technicianId, chemicalName, quantityUsed, unit, targetPests, weatherConditions, photoUrl, inventoryItemId, epaRegistrationNo } = req.body;
        if (!jobId || !technicianId || !chemicalName || quantityUsed === undefined || !unit) {
            return reply.status(400).json({ error: 'Missing required chemical application log fields' });
        }
        const qty = parseFloat(quantityUsed) || 0;
        // 1. Create Chemical Application Log
        const chemLog = await prisma.chemicalApplicationLog.create({
            data: {
                jobId,
                technicianId,
                chemicalName,
                quantityUsed: qty,
                unit,
                targetPests: targetPests || [],
                weatherConditions: weatherConditions || null,
                photoUrl: photoUrl || null,
                inventoryItemId: inventoryItemId || null,
                epaRegistrationNo: epaRegistrationNo || null
            }
        });
        // 2. Auto-Deduct from Inventory if linked
        let updatedInventory = null;
        let autoPoCreated = false;
        let targetItemId = inventoryItemId;
        if (!targetItemId && tenantId) {
            const match = await prisma.inventoryItem.findFirst({
                where: { tenantId, name: { equals: chemicalName, mode: 'insensitive' } }
            });
            if (match)
                targetItemId = match.id;
        }
        if (targetItemId) {
            const unitsToDeduct = Math.max(1, Math.round(qty));
            const item = await prisma.inventoryItem.update({
                where: { id: targetItemId },
                data: {
                    quantity: { decrement: unitsToDeduct }
                }
            });
            updatedInventory = item;
            // 3. Auto-Draft Purchase Order if below threshold
            if (item.quantity <= item.minimumThreshold) {
                const existingDraft = await prisma.purchaseOrder.findFirst({
                    where: { itemId: item.id, status: 'draft' }
                });
                if (!existingDraft) {
                    const reorderQty = Math.max(item.minimumThreshold * 2, 20);
                    await prisma.purchaseOrder.create({
                        data: {
                            tenantId: item.tenantId,
                            itemId: item.id,
                            quantity: reorderQty,
                            status: 'draft',
                            expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                        }
                    });
                    autoPoCreated = true;
                }
            }
        }
        reply.status(201).json({
            chemicalLog: chemLog,
            updatedInventory,
            autoPoCreated
        });
    }
    catch (error) {
        console.error('Error recording chemical application:', error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.recordChemicalApplication = recordChemicalApplication;
// EPA Compliance & Chemical Usage Report
const getEpaComplianceReport = async (req, reply) => {
    try {
        const { startDate, endDate } = req.query;
        const whereClause = {};
        if (startDate || endDate) {
            whereClause.appliedAt = {};
            if (startDate)
                whereClause.appliedAt.gte = new Date(startDate);
            if (endDate)
                whereClause.appliedAt.lte = new Date(endDate);
        }
        const logs = await prisma.chemicalApplicationLog.findMany({
            where: whereClause,
            include: {
                job: {
                    include: { customer: true, property: true }
                },
                technician: {
                    include: { user: true }
                },
                inventoryItem: true
            },
            orderBy: { appliedAt: 'desc' }
        });
        // Aggregate summary by chemical
        const summaryMap = {};
        logs.forEach(log => {
            const key = `${log.chemicalName}__${log.epaRegistrationNo || 'N/A'}`;
            if (!summaryMap[key]) {
                summaryMap[key] = {
                    chemicalName: log.chemicalName,
                    epaRegistrationNo: log.epaRegistrationNo || log.inventoryItem?.sku || 'N/A',
                    totalQuantityUsed: 0,
                    unit: log.unit,
                    applicationCount: 0,
                    targetPests: new Set()
                };
            }
            summaryMap[key].totalQuantityUsed += Number(log.quantityUsed);
            summaryMap[key].applicationCount += 1;
            if (Array.isArray(log.targetPests)) {
                log.targetPests.forEach((p) => summaryMap[key].targetPests.add(String(p)));
            }
        });
        const summary = Object.values(summaryMap).map(s => ({
            ...s,
            totalQuantityUsed: parseFloat(s.totalQuantityUsed.toFixed(2)),
            targetPests: Array.from(s.targetPests)
        }));
        reply.send({
            reportPeriod: { startDate: startDate || null, endDate: endDate || null },
            totalApplications: logs.length,
            chemicalSummary: summary,
            logs
        });
    }
    catch (error) {
        console.error('Error generating EPA compliance report:', error);
        reply.status(500).json({ error: 'Internal server error' });
    }
};
exports.getEpaComplianceReport = getEpaComplianceReport;
