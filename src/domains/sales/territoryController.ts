import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getTerritories = async (req: FastifyRequest, reply: FastifyReply) => {
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

    reply.send(enriched);
  } catch (error) {
    console.error('Error fetching territories:', error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};

export const getTerritoryById = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = (req.params as any);
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
      return reply.status(404).send({ error: 'Territory not found' });
    }

    reply.send(territory);
  } catch (error) {
    console.error('Error fetching territory:', error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};

export const createTerritory = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const tenantId = (req as any).user?.tenantId || '00000000-0000-0000-0000-000000000000';
    const {
      name,
      description,
      assignedRepId,
      color,
      polygonCoordinates,
      quotaTarget
    } = (req.body as any);

    if (!name || !polygonCoordinates) {
      return reply.status(400).send({ error: 'name and polygonCoordinates are required' });
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

    reply.status(201).send(territory);
  } catch (error) {
    console.error('Error creating territory:', error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};

export const updateTerritory = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = (req.params as any);
    const {
      name,
      description,
      assignedRepId,
      color,
      polygonCoordinates,
      quotaTarget,
      isActive
    } = (req.body as any);

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

    reply.send(updated);
  } catch (error) {
    console.error('Error updating territory:', error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};

export const deleteTerritory = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = (req.params as any);
    await prisma.territory.delete({ where: { id } });
    reply.send({ success: true, message: 'Territory deleted successfully' });
  } catch (error) {
    console.error('Error deleting territory:', error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};

export const getTerritoryAnalytics = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = (req.params as any);
    const territory = await prisma.territory.findUnique({
      where: { id },
      include: {
        assignedRep: true,
        canvassPins: true,
        doNotKnockRecords: true
      }
    });

    if (!territory) {
      return reply.status(404).send({ error: 'Territory not found' });
    }

    const totalKnocked = territory.canvassPins.length;
    const sold = territory.canvassPins.filter(p => p.status === 'SOLD').length;
    const pitched = territory.canvassPins.filter(p => p.status === 'PITCHED').length;
    const notHome = territory.canvassPins.filter(p => p.status === 'NOT_HOME').length;
    const notInterested = territory.canvassPins.filter(p => p.status === 'NOT_INTERESTED').length;
    const dnk = territory.doNotKnockRecords.length;

    const quota = Number(territory.quotaTarget) || 0;
    const quotaAttainment = quota > 0 ? Math.round((sold / quota) * 100) : 100;

    reply.send({
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
    reply.status(500).send({ error: 'Internal server error' });
  }
};

export const getDoNotKnockList = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const tenantId = (req as any).user?.tenantId || '00000000-0000-0000-0000-000000000000';
    const records = await prisma.doNotKnockRecord.findMany({
      where: { tenantId },
      include: { territory: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    reply.send(records);
  } catch (error) {
    console.error('Error fetching DNK records:', error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};

export const createDoNotKnock = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const tenantId = (req as any).user?.tenantId || '00000000-0000-0000-0000-000000000000';
    const { address, lat, lng, reason, territoryId, expiresAt } = (req.body as any);

    if (!address) {
      return reply.status(400).send({ error: 'address is required' });
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

    reply.status(201).send(record);
  } catch (error) {
    console.error('Error creating DNK record:', error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};

export const deleteDoNotKnock = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = (req.params as any);
    await prisma.doNotKnockRecord.delete({ where: { id } });
    reply.send({ success: true, message: 'Do Not Knock restriction removed' });
  } catch (error) {
    console.error('Error deleting DNK record:', error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};
