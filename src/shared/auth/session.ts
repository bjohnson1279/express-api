import { PrismaClient } from '@prisma/client';
import { callbackActor } from '../../domains/crm/callbackService';
const prisma = new PrismaClient();
export interface SessionActor { id: string; tenantId: string; role: string; email: string }
export class SessionError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function authenticate(authorization?: string): Promise<SessionActor> {
  const identity = callbackActor(authorization);
  const claims = JSON.parse(Buffer.from(authorization!.slice(7).split('.')[1], 'base64url').toString());
  const actor = await prisma.user.findUnique({ where: { id: identity.id }, select: { id: true, tenantId: true, role: true, email: true } });
  if (!actor || actor.tenantId !== identity.tenantId || actor.role !== claims.role) throw new SessionError(401, 'Session is no longer valid');
  return actor;
}
export const staffRoles = ['SUPER_ADMIN', 'MANAGER', 'DISPATCHER', 'CUSTOMER_SERVICE_REP', 'DOOR_TO_DOOR_SALES'];
// Canonical commands authorize resource ownership and role in PostgreSQL.
export function requiredRoles(path: string): string[] | null {
  const route = path.split('?')[0].replace(/\/$/, '');
  if (route === '/graphql') return null;
  if (/^\/api\/v1\/(callbacks|inspections|devices|catalog|recurring|profitability|commercial|jobs)(\/|$)/.test(route)) return null;
  if (/^\/api\/(?:v1\/)?(hr|finance|inventory|marketing|quotes|invoices|payments|commissions|expenses|accounting)(\/|$)/.test(route)) return ['SUPER_ADMIN', 'MANAGER'];
  if (/^\/api\/(?:v1\/)?dispatch(\/|$)/.test(route)) return ['SUPER_ADMIN', 'MANAGER', 'DISPATCHER'];
  return staffRoles;
}
