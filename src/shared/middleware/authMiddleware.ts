import { FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../auth/session';

// Extend the Fastify Request type to include the user
export interface AuthRequest extends FastifyRequest {
  user?: {
    id: string;
    role: string;
    tenantId: string;
  };
}

export const verifyToken = async (req: AuthRequest, reply: FastifyReply) => {
  if (req.user) return;
  try { req.user = await authenticate(req.headers.authorization); }
  catch (error: any) { return reply.status(error.status || 503).send({ error: error.status ? error.message : 'Authentication unavailable' }); }
};

export const requireRole = (roles: string[]) => {
  return async (req: AuthRequest, reply: FastifyReply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    
    if (!roles.includes(req.user.role)) {
      return reply.status(403).send({ error: 'Forbidden: Insufficient permissions' });
    }
  };
};
