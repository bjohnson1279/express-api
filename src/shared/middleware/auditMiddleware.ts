import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const auditMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  // Only capture mutations (POST, PUT, PATCH, DELETE)
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    // Intercept response finish
    res.on('finish', async () => {
      // Don't audit auth or very noisy endpoints if needed
      if (req.path.includes('/auth') || req.path.includes('/health')) return;

      const tenantId = (req as any).user?.tenantId || '00000000-0000-0000-0000-000000000000';
      const actorId = (req as any).user?.id || null;
      const actorRole = (req as any).user?.role || null;
      
      const action = req.method;
      
      // Try to parse entityType from path e.g. /api/v1/jobs -> jobs
      const parts = req.path.split('/');
      let entityType = 'unknown';
      let entityId = '00000000-0000-0000-0000-000000000000'; // Default zero UUID if none found
      
      for (let i = 0; i < parts.length; i++) {
        if (parts[i] === 'v1' || parts[i] === 'api') continue;
        if (!parts[i]) continue;
        // If part is a UUID, it's the entity ID
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parts[i])) {
          entityId = parts[i];
        } else if (entityType === 'unknown') {
          entityType = parts[i];
        }
      }

      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent') || null;
      const newValues = req.body;

      try {
        await prisma.$executeRawUnsafe(`
          INSERT INTO audit_logs (id, tenant_id, actor_id, actor_role, action, entity_type, entity_id, new_values, ip_address, user_agent, created_at)
          VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, $4, $5, $6::uuid, $7::jsonb, $8, $9, NOW())
        `, tenantId, actorId, actorRole, action, entityType, entityId, JSON.stringify(newValues), ipAddress, userAgent);
      } catch (err) {
        console.error('Audit Log capture failed:', err);
      }
    });
  }

  next();
};
