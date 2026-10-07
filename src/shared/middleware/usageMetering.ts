import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const usageMetering = async (req: FastifyRequest, reply: FastifyReply) => {
  const tenantId = (req as any).user?.tenantId;
  if (tenantId && req.routeOptions) {
    const endpoint = req.routeOptions.url;
    const method = req.method;
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);

    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO api_usage_metrics (id, tenant_id, endpoint, method, date, request_count)
        VALUES (gen_random_uuid(), $1::uuid, $2, $3, $4::date, 1)
        ON CONFLICT (tenant_id, endpoint, method, date) 
        DO UPDATE SET request_count = api_usage_metrics.request_count + 1
      `, tenantId, endpoint, method, date);
    } catch (err) {
      console.error('Failed to record API usage', err);
    }
  }
};
