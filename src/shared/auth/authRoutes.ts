import rateLimit from '@fastify/rate-limit';
import { FastifyPluginAsync } from 'fastify';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { hashPassword, verifyPassword } from './password';
import { AuthRequest, verifyToken } from '../middleware/authMiddleware';
const prisma = new PrismaClient();
const staffRoles = ['SUPER_ADMIN', 'MANAGER', 'DISPATCHER', 'CUSTOMER_SERVICE_REP', 'DOOR_TO_DOOR_SALES'];
const routes: FastifyPluginAsync = async app => {
  await app.register(rateLimit, { global: false, keyGenerator: req => req.raw.socket.remoteAddress || 'unknown' });
  const dummyHash = 'pbkdf2_sha256:600000:' + '0'.repeat(32) + ':' + '0'.repeat(64);
  app.post('/login', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const secret = process.env.JWT_SECRET;
    if (!secret) return reply.code(503).send({ error: 'Sign-in is not configured' });
    const body = req.body as { email?: unknown; password?: unknown } | null;
    if (typeof body?.email !== 'string' || typeof body?.password !== 'string' || body.email.length > 255 || body.password.length > 1024) {
      return reply.code(400).send({ error: 'Email and password are required' });
    }
    const user = await prisma.user.findUnique({ where: { email: body.email.trim().toLowerCase() } });
    const hash = user && /^(scrypt:|pbkdf2_sha256:)/.test(user.passwordHash) ? user.passwordHash : dummyHash;
    const valid = await verifyPassword(body.password, hash);
    if (!user || !valid || !staffRoles.includes(user.role) || hash === dummyHash) return reply.code(401).send({ error: 'Invalid email or password' });
    if (user.passwordHash.startsWith('scrypt:')) await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(body.password) } });
    const actor = { id: user.id, tenantId: user.tenantId, role: user.role, email: user.email };
    return { token: jwt.sign(actor, secret, { algorithm: 'HS256', expiresIn: '1h' }), user: actor };
  });
  app.get('/me', { onRequest: verifyToken }, async (req: AuthRequest, reply) => {
    reply.header('Cache-Control', 'no-store');
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { id: true, tenantId: true, role: true, email: true } });
    if (!user || user.tenantId !== req.user!.tenantId || user.role !== req.user!.role) return reply.code(401).send({ error: 'Session is no longer valid' });
    if (!staffRoles.includes(user.role)) return reply.code(403).send({ error: 'Staff access is required' });
    return { user };
  });
};
export default routes;
