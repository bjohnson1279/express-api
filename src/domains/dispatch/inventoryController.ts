import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../../shared/middleware/authMiddleware';

const prisma = new PrismaClient();

export const getInventoryItems = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const items = await prisma.inventoryItem.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' }
    });
    res.json(items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createInventoryItem = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId!;
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
    res.status(201).json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateInventoryQuantity = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { quantityDelta } = req.body; // positive to add, negative to consume
    
    const item = await prisma.inventoryItem.update({
      where: { id },
      data: {
        quantity: { increment: parseInt(quantityDelta) }
      }
    });
    res.json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPurchaseOrders = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const pos = await prisma.purchaseOrder.findMany({
      where: { tenantId },
      include: { item: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(pos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createPurchaseOrder = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId!;
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
    res.status(201).json(po);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Chemical Application Tracking with Inventory Auto-Deduction
export const recordChemicalApplication = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const {
      jobId,
      technicianId,
      chemicalName,
      quantityUsed,
      unit,
      targetPests,
      weatherConditions,
      photoUrl,
      inventoryItemId,
      epaRegistrationNo
    } = req.body;

    if (!jobId || !technicianId || !chemicalName || quantityUsed === undefined || !unit) {
      return res.status(400).json({ error: 'Missing required chemical application log fields' });
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
      if (match) targetItemId = match.id;
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

    res.status(201).json({
      chemicalLog: chemLog,
      updatedInventory,
      autoPoCreated
    });
  } catch (error) {
    console.error('Error recording chemical application:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// EPA Compliance & Chemical Usage Report
export const getEpaComplianceReport = async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const whereClause: any = {};
    if (startDate || endDate) {
      whereClause.appliedAt = {};
      if (startDate) whereClause.appliedAt.gte = new Date(startDate as string);
      if (endDate) whereClause.appliedAt.lte = new Date(endDate as string);
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
    const summaryMap: Record<string, {
      chemicalName: string;
      epaRegistrationNo: string;
      totalQuantityUsed: number;
      unit: string;
      applicationCount: number;
      targetPests: Set<string>;
    }> = {};

    logs.forEach(log => {
      const key = `${log.chemicalName}__${log.epaRegistrationNo || 'N/A'}`;
      if (!summaryMap[key]) {
        summaryMap[key] = {
          chemicalName: log.chemicalName,
          epaRegistrationNo: log.epaRegistrationNo || log.inventoryItem?.sku || 'N/A',
          totalQuantityUsed: 0,
          unit: log.unit,
          applicationCount: 0,
          targetPests: new Set<string>()
        };
      }
      summaryMap[key].totalQuantityUsed += Number(log.quantityUsed);
      summaryMap[key].applicationCount += 1;

      if (Array.isArray(log.targetPests)) {
        log.targetPests.forEach((p: any) => summaryMap[key].targetPests.add(String(p)));
      }
    });

    const summary = Object.values(summaryMap).map(s => ({
      ...s,
      totalQuantityUsed: parseFloat(s.totalQuantityUsed.toFixed(2)),
      targetPests: Array.from(s.targetPests)
    }));

    res.json({
      reportPeriod: { startDate: startDate || null, endDate: endDate || null },
      totalApplications: logs.length,
      chemicalSummary: summary,
      logs
    });
  } catch (error) {
    console.error('Error generating EPA compliance report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
