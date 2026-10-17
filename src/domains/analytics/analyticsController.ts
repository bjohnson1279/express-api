import { dashboardSummary } from './dashboardService';
import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '../../shared/database';
import PDFDocument from 'pdfkit';

const prisma = new PrismaClient();

export const getDashboardAnalytics = async (req: FastifyRequest, reply: FastifyReply) => {
  try { return reply.header('Cache-Control','no-store').send(await dashboardSummary(req.headers.authorization)); }
  catch(error:any) { return reply.status(error.status||500).send({error:error.status ? error.message : 'Dashboard unavailable'}); }
};

import { PestRiskService } from './pestRiskService';
import { ClimateService } from './ClimateService';

export const getClimateMetrics = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const lat = (req.query as any).lat ? parseFloat(String((req.query as any).lat)) : 39.7817;
    const lng = (req.query as any).lng ? parseFloat(String((req.query as any).lng)) : -89.6501;

    const climate = await ClimateService.getClimateData(lat, lng);
    reply.send(climate);
  } catch (error: any) {
    console.error('Error fetching climate data:', error);
    reply.status(500).send({ error: error.message || 'Internal server error' });
  }
};


export const getPropertyPestRisk = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { propertyId } = (req.params as any);
    const tenantId = (req as any).tenantId || req.headers['x-tenant-id'] || '3fa85f64-5717-4562-b3fc-2c963f66afa6';

    const prediction = await PestRiskService.calculatePropertyRisk(propertyId, String(tenantId));
    reply.send(prediction);
  } catch (error: any) {
    console.error('Error calculating pest risk:', error);
    reply.status(500).send({ error: error.message || 'Internal server error' });
  }
};

export const getPestRiskHeatmap = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const tenantId = (req as any).tenantId || req.headers['x-tenant-id'] || '3fa85f64-5717-4562-b3fc-2c963f66afa6';
    const heatmap = await PestRiskService.getHeatmapData(String(tenantId));
    reply.send(heatmap);
  } catch (error: any) {
    console.error('Error fetching pest risk heatmap:', error);
    reply.status(500).send({ error: error.message || 'Internal server error' });
  }
};

export const recalculatePestRisks = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const tenantId = (req as any).tenantId || req.headers['x-tenant-id'] || '3fa85f64-5717-4562-b3fc-2c963f66afa6';
    const heatmap = await PestRiskService.getHeatmapData(String(tenantId));
    reply.send({ success: true, count: heatmap.length, records: heatmap });
  } catch (error: any) {
    console.error('Error recalculating pest risks:', error);
    reply.status(500).send({ error: error.message || 'Internal server error' });
  }
};

export const getLaborCosts = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const jobs = await prisma.job.findMany({
      where: { status: 'completed', onSiteTimeMinutes: { not: null } },
      include: { technician: { include: { user: { select: { id: true, tenantId: true, email: true, role: true, createdAt: true, updatedAt: true } } } } }
    });

    const laborAnalytics: Record<string, { technician: string, totalOnSiteMinutes: number, totalDriveMinutes: number, jobsCount: number }> = {};
    
    jobs.forEach(job => {
      if (job.technician && job.technician.user) {
        const id = job.technician.id;
        if (!laborAnalytics[id]) {
           laborAnalytics[id] = { technician: job.technician.user.email, totalOnSiteMinutes: 0, totalDriveMinutes: 0, jobsCount: 0 };
        }
        laborAnalytics[id].totalOnSiteMinutes += job.onSiteTimeMinutes || 0;
        laborAnalytics[id].totalDriveMinutes += job.driveTimeMinutes || 0;
        laborAnalytics[id].jobsCount += 1;
      }
    });

    reply.send(Object.values(laborAnalytics));
  } catch (error) {
    console.error(error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};


import { Parser } from 'json2csv';

export const exportReport = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { format = 'csv', type = 'revenue' } = (req.query as any);

    let data: any[] = [];
    if (type === 'productivity') {
      const jobs = await prisma.job.findMany({ include: { technician: { include: { user: { select: { id: true, tenantId: true, email: true, role: true, createdAt: true, updatedAt: true } } }} } });
      const stats: any = {};
      jobs.forEach(j => {
        if (j.technician?.user) {
          const email = j.technician.user.email;
          if (!stats[email]) stats[email] = { Technician: email, Completed: 0, TotalOnSiteMinutes: 0 };
          if (j.status === 'completed') {
            stats[email].Completed += 1;
            stats[email].TotalOnSiteMinutes += j.onSiteTimeMinutes || 0;
          }
        }
      });
      data = Object.values(stats);
    } else if (type === 'revenue') {
      const invoices = await prisma.invoice.findMany({ include: { job: { include: { customer: true } } } });
      data = invoices.map(i => ({
        InvoiceID: i.id,
        Status: i.status,
        Customer: i.job?.customer?.name || 'Unknown',
        Amount: i.totalAmount
      }));
    } else if (type === 'chemicals') {
      const usage = await prisma.chemicalApplicationLog.findMany({ include: { inventoryItem: true, job: { include: { customer: true } } } });
      data = usage.map(u => ({
        Chemical: u.chemicalName,
        Quantity: u.quantityUsed,
        Unit: u.unit,
        AppliedAt: u.appliedAt,
        Customer: u.job?.customer?.name || 'Unknown'
      }));
    } else {
      return reply.status(400).send({ error: 'Unsupported report type. Use revenue, productivity, or chemicals.' });
    }

    if (data.length === 0) {
      data = [{ Message: 'No data available for this report type.' }];
    }

    if (format === 'csv') {
      const json2csvParser = new Parser();
      const csv = json2csvParser.parse(data);
      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', `attachment; filename="${type}-report.csv"`);
      return reply.send(csv);
    } else if (format === 'pdf') {
      const doc = new PDFDocument();
      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="${type}-report.pdf"`);

      doc.fontSize(20).text(`${String(type).toUpperCase()} REPORT`, { align: 'center' });
      doc.moveDown();
      
      data.forEach(item => {
        doc.fontSize(10).text(JSON.stringify(item, null, 2));
        doc.moveDown();
      });

      doc.end();
      return reply.send(doc);
    } else {
      reply.status(400).send({ error: 'Unsupported format type. Use csv or pdf' });
    }
  } catch (error) {
    console.error('Error generating report:', error);
    reply.status(500).send({ error: 'Internal server error' });
  }
};
