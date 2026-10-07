"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditMiddleware = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const auditMiddleware = async (req, reply) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        const url = req.url.split('?')[0];
        if (url.includes('/auth') || url.includes('/health'))
            return;
        const tenantId = req.user?.tenantId || '00000000-0000-0000-0000-000000000000';
        const actorId = req.user?.id || null;
        const actorRole = req.user?.role || null;
        const action = req.method;
        const parts = url.split('/');
        let entityType = 'unknown';
        let entityId = '00000000-0000-0000-0000-000000000000';
        for (let i = 0; i < parts.length; i++) {
            if (parts[i] === 'v1' || parts[i] === 'api')
                continue;
            if (!parts[i])
                continue;
            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parts[i])) {
                entityId = parts[i];
            }
            else if (entityType === 'unknown') {
                entityType = parts[i];
            }
        }
        const ipAddress = req.ip;
        const userAgent = req.headers['user-agent'] || null;
        const newValues = req.body || {};
        try {
            await prisma.$executeRawUnsafe(`
        INSERT INTO audit_logs (id, tenant_id, actor_id, actor_role, action, entity_type, entity_id, new_values, ip_address, user_agent, created_at)
        VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, $4, $5, $6::uuid, $7::jsonb, $8, $9, NOW())
      `, tenantId, actorId, actorRole, action, entityType, entityId, JSON.stringify(newValues), ipAddress, userAgent);
        }
        catch (err) {
            console.error('Audit Log capture failed:', err);
        }
    }
};
exports.auditMiddleware = auditMiddleware;
