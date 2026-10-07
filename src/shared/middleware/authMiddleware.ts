import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';

// Extend the Fastify Request type to include the user
export interface AuthRequest extends FastifyRequest {
  user?: {
    id: string;
    role: string;
    tenantId: string;
  };
}

export const verifyToken = async (req: AuthRequest, reply: FastifyReply) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // For development, if no JWT secret is set, we might mock a user
    if (process.env.NODE_ENV === 'development' && !process.env.JWT_SECRET) {
      req.user = { id: 'mock-admin-id', role: 'SUPER_ADMIN', tenantId: 'mock-tenant-id' };
      return;
    }
    return reply.status(401).send({ error: 'Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as any;
    req.user = decoded;
  } catch (error) {
    return reply.status(401).send({ error: 'Invalid token' });
  }
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
