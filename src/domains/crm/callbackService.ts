import { createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export class CallbackError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export interface CallbackActor { id: string; tenantId: string }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// No development identity or fallback signing secret for warranty decisions.
export function callbackActor(authorization?: string): CallbackActor {
  if (!process.env.JWT_SECRET) throw new CallbackError(503, 'Callback authentication is not configured');
  if (!authorization?.startsWith('Bearer ')) throw new CallbackError(401, 'Sign in to use callbacks');
  try {
    const parts = authorization.slice(7).split('.');
    if (parts.length !== 3 || parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p))) throw new Error();
    const [header, payload, signature] = parts;
    if (JSON.parse(Buffer.from(header,'base64url').toString()).alg !== 'HS256') throw new Error();
    const expected = createHmac('sha256',process.env.JWT_SECRET).update(`${header}.${payload}`).digest();
    const received = Buffer.from(signature,'base64url');
    if (received.length !== expected.length || !timingSafeEqual(received,expected)) throw new Error();
    const claims = JSON.parse(Buffer.from(payload,'base64url').toString());
    const now = Date.now()/1000;
    if (typeof claims.id !== 'string' || typeof claims.tenantId !== 'string' || !uuid.test(claims.id) || !uuid.test(claims.tenantId)
      || typeof claims.exp !== 'number' || !Number.isFinite(claims.exp) || claims.exp <= now
      || claims.nbf !== undefined && (typeof claims.nbf !== 'number' || !Number.isFinite(claims.nbf) || claims.nbf > now)) throw new Error();
    return { id: claims.id, tenantId: claims.tenantId };
  } catch { throw new CallbackError(401, 'Invalid or expired token'); }
}

export async function callbackCommand(actor: CallbackActor, action: string, body: Record<string, unknown> = {}) {
  try {
    const rows = await prisma.$queryRaw<{ result: unknown }[]>`
      SELECT callback_api(${action}::text, ${actor.tenantId}::uuid, ${actor.id}::uuid, ${JSON.stringify(body)}::jsonb) AS result`;
    return rows[0].result;
  } catch (error: any) {
    const code = error?.meta?.code;
    const message = error?.meta?.message || '';
    const status = ({ P0400: 400, P0401: 401, P0403: 403, P0404: 404, P0409: 409, P0503: 503 } as Record<string, number>)[code];
    if (status) throw new CallbackError(status, message.replace(/^ERROR:\s*/, ''));
    if (['22P02', '22007', '22008', '22023', '23502', '23514'].includes(code)) throw new CallbackError(400, 'Invalid callback fields');
    if (code === '23505') throw new CallbackError(409, 'Record already exists');
    throw new CallbackError(500, 'Callback operation failed');
  }
}
