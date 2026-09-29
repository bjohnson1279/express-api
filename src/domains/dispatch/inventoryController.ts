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
