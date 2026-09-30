import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getDashboardAnalytics = async (req: Request, res: Response) => {
  try {
    const contracts = await prisma.serviceContract.findMany({
      where: { status: 'active' }
    });
    
    // Approximate MRR (Monthly Recurring Revenue)
    let mrr = 0;
    contracts.forEach(c => {
      const amt = Number(c.recurringAmount || 0);
      switch(c.cadence) {
        case 'MONTHLY': mrr += amt; break;
        case 'QUARTERLY': mrr += (amt / 3); break;
        case 'SEMI_ANNUALLY': mrr += (amt / 6); break;
        case 'ANNUALLY': mrr += (amt / 12); break;
        case 'BI_MONTHLY': mrr += (amt / 2); break;
      }
    });

    const commissions = await prisma.commission.findMany({
      include: { salesRep: true }
    });
    const totalCommissions = commissions.reduce((sum, c) => sum + Number(c.amount), 0);

    const invoices = await prisma.invoice.findMany();
    const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + Number(i.totalAmount), 0);
    
    // Calculate jobs completed by technician for leaderboard
    const completedJobs = await prisma.job.findMany({
      where: { status: 'completed' },
      include: { technician: { include: { user: true } } }
    });
    
    const techLeaderboard: Record<string, {name: string, count: number}> = {};
    completedJobs.forEach(job => {
      if (job.technician && job.technician.user) {
        const id = job.technician.id;
        if (!techLeaderboard[id]) techLeaderboard[id] = { name: job.technician.user.email, count: 0 };
        techLeaderboard[id].count += 1;
      }
    });

    // Sales Rep leaderboard by commissions
    const salesLeaderboard: Record<string, {name: string, revenue: number}> = {};
    commissions.forEach(c => {
      if (c.salesRep) {
        const id = c.salesRepId;
        if (!salesLeaderboard[id]) salesLeaderboard[id] = { name: c.salesRep.email, revenue: 0 };
        salesLeaderboard[id].revenue += Number(c.amount);
      }
    });

    res.json({
      mrr,
      arr: mrr * 12,
      totalCommissions,
      totalRevenue,
      activeContractsCount: contracts.length,
      techLeaderboard: Object.values(techLeaderboard).sort((a, b) => b.count - a.count).slice(0, 5),
      salesLeaderboard: Object.values(salesLeaderboard).sort((a, b) => b.revenue - a.revenue).slice(0, 5)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

import { PestRiskService } from './PestRiskService';
import { ClimateService } from './ClimateService';

export const getClimateMetrics = async (req: Request, res: Response) => {
  try {
    const lat = req.query.lat ? parseFloat(String(req.query.lat)) : 39.7817;
    const lng = req.query.lng ? parseFloat(String(req.query.lng)) : -89.6501;

    const climate = await ClimateService.getClimateData(lat, lng);
    res.json(climate);
  } catch (error: any) {
    console.error('Error fetching climate data:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};


export const getPropertyPestRisk = async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    const tenantId = (req as any).tenantId || req.headers['x-tenant-id'] || '3fa85f64-5717-4562-b3fc-2c963f66afa6';

    const prediction = await PestRiskService.calculatePropertyRisk(propertyId, String(tenantId));
    res.json(prediction);
  } catch (error: any) {
    console.error('Error calculating pest risk:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getPestRiskHeatmap = async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || req.headers['x-tenant-id'] || '3fa85f64-5717-4562-b3fc-2c963f66afa6';
    const heatmap = await PestRiskService.getHeatmapData(String(tenantId));
    res.json(heatmap);
  } catch (error: any) {
    console.error('Error fetching pest risk heatmap:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const recalculatePestRisks = async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId || req.headers['x-tenant-id'] || '3fa85f64-5717-4562-b3fc-2c963f66afa6';
    const heatmap = await PestRiskService.getHeatmapData(String(tenantId));
    res.json({ success: true, count: heatmap.length, records: heatmap });
  } catch (error: any) {
    console.error('Error recalculating pest risks:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

