import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getTerritories = async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId || '00000000-0000-0000-0000-000000000000';
    const territories = await prisma.territory.findMany({
      where: { tenantId },
      include: {
        assignedRep: {
          select: { id: true, email: true, role: true }
        },
        canvassPins: {
          select: { id: true, status: true, isDoNotKnock: true }
        },
        doNotKnockRecords: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const enriched = territories.map(t => {
      const totalPins = t.canvassPins.length;
      const pitched = t.canvassPins.filter(p => p.status === 'PITCHED').length;
      const sold = t.canvassPins.filter(p => p.status === 'SOLD').length;
      const notHome = t.canvassPins.filter(p => p.status === 'NOT_HOME').length;
      const notInterested = t.canvassPins.filter(p => p.status === 'NOT_INTERESTED').length;
      const dnkCount = t.canvassPins.filter(p => p.isDoNotKnock).length + t.doNotKnockRecords.length;
      const conversionRate = pitched > 0 ? Math.round((sold / pitched) * 100) : 0;
      const penetrationRate = totalPins > 0 ? Math.round((sold / totalPins) * 100) : 0;

      return {
        ...t,
        stats: {
          totalPins,
          pitched,
          sold,
          notHome,
          notInterested,
          dnkCount,
          conversionRate,
          penetrationRate
        }
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error('Error fetching territories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTerritoryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const territory = await prisma.territory.findUnique({
      where: { id },
      include: {
        assignedRep: {
          select: { id: true, email: true, role: true }
        },
        canvassPins: {
          include: { salesRep: { select: { id: true, email: true } } }
        },
        doNotKnockRecords: true
      }
    });

    if (!territory) {
      return res.status(404).json({ error: 'Territory not found' });
    }

    res.json(territory);
  } catch (error) {
    console.error('Error fetching territory:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createTerritory = async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId || '00000000-0000-0000-0000-000000000000';
    const {
      name,
      description,
      assignedRepId,
      color,
      polygonCoordinates,
      quotaTarget
    } = req.body;

    if (!name || !polygonCoordinates) {
      return res.status(400).json({ error: 'name and polygonCoordinates are required' });
    }

    const territory = await prisma.territory.create({
      data: {
        tenantId,
        name,
        description: description || null,
        assignedRepId: assignedRepId || null,
        color: color || '#3b82f6',
        polygonCoordinates,
        quotaTarget: quotaTarget ? parseFloat(quotaTarget) : 0.00,
        isActive: true
      },
      include: {
        assignedRep: {
          select: { id: true, email: true, role: true }
        }
      }
    });

    res.status(201).json(territory);
  } catch (error) {
    console.error('Error creating territory:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateTerritory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      assignedRepId,
      color,
      polygonCoordinates,
      quotaTarget,
      isActive
    } = req.body;

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (assignedRepId !== undefined) data.assignedRepId = assignedRepId || null;
    if (color !== undefined) data.color = color;
    if (polygonCoordinates !== undefined) data.polygonCoordinates = polygonCoordinates;
    if (quotaTarget !== undefined) data.quotaTarget = parseFloat(quotaTarget);
    if (isActive !== undefined) data.isActive = isActive;

    const updated = await prisma.territory.update({
      where: { id },
      data,
      include: {
        assignedRep: {
          select: { id: true, email: true, role: true }
        }
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating territory:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteTerritory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.territory.delete({ where: { id } });
    res.json({ success: true, message: 'Territory deleted successfully' });
  } catch (error) {
    console.error('Error deleting territory:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTerritoryAnalytics = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const territory = await prisma.territory.findUnique({
      where: { id },
      include: {
        assignedRep: true,
        canvassPins: true,
        doNotKnockRecords: true
      }
    });

    if (!territory) {
      return res.status(404).json({ error: 'Territory not found' });
    }

    const totalKnocked = territory.canvassPins.length;
    const sold = territory.canvassPins.filter(p => p.status === 'SOLD').length;
    const pitched = territory.canvassPins.filter(p => p.status === 'PITCHED').length;
    const notHome = territory.canvassPins.filter(p => p.status === 'NOT_HOME').length;
    const notInterested = territory.canvassPins.filter(p => p.status === 'NOT_INTERESTED').length;
    const dnk = territory.doNotKnockRecords.length;

    const quota = Number(territory.quotaTarget) || 0;
    const quotaAttainment = quota > 0 ? Math.round((sold / quota) * 100) : 100;

    res.json({
      territoryId: territory.id,
      name: territory.name,
      assignedRep: territory.assignedRep ? {
        id: territory.assignedRep.id,
        email: territory.assignedRep.email
      } : null,
      quotaTarget: quota,
      dealsClosed: sold,
      quotaAttainmentPercent: quotaAttainment,
      totalDoorsKnocked: totalKnocked,
      leadsPitched: pitched,
      notHomeCount: notHome,
      notInterestedCount: notInterested,
      doNotKnockCount: dnk,
      penetrationRate: totalKnocked > 0 ? (sold / totalKnocked) * 100 : 0
    });
  } catch (error) {
    console.error('Error getting territory analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getDoNotKnockList = async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId || '00000000-0000-0000-0000-000000000000';
    const records = await prisma.doNotKnockRecord.findMany({
      where: { tenantId },
      include: { territory: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(records);
  } catch (error) {
    console.error('Error fetching DNK records:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createDoNotKnock = async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId || '00000000-0000-0000-0000-000000000000';
    const { address, lat, lng, reason, territoryId, expiresAt } = req.body;

    if (!address) {
      return res.status(400).json({ error: 'address is required' });
    }

    const record = await prisma.doNotKnockRecord.create({
      data: {
        tenantId,
        address,
        lat: lat ? parseFloat(lat) : null,
        lng: lng ? parseFloat(lng) : null,
        reason: reason || 'Customer Request',
        territoryId: territoryId || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null
      }
    });

    res.status(201).json(record);
  } catch (error) {
    console.error('Error creating DNK record:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteDoNotKnock = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.doNotKnockRecord.delete({ where: { id } });
    res.json({ success: true, message: 'Do Not Knock restriction removed' });
  } catch (error) {
    console.error('Error deleting DNK record:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
