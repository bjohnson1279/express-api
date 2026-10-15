import { createHmac } from 'crypto';
jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn(() => ({ user: { findUnique: jest.fn() }, customer: { findMany: jest.fn(), findFirst: jest.fn() } })) }));
import { PrismaClient } from '@prisma/client';
import { authenticate, requiredRoles } from '../src/shared/auth/session';
import { getCustomers, getCustomer } from '../src/domains/crm/customerController';
import { eventBus } from '../src/domains/comms/eventBus';
const actor = { id: '11111111-1111-4111-8111-111111111111', tenantId: '22222222-2222-4222-8222-222222222222', role: 'MANAGER', email: 'test@example.invalid' };
const databases = (PrismaClient as jest.Mock).mock.results.map(r => r.value);
const clients = () => databases;
function token(overrides: any = {}, secret = 'session-test-secret') {
  const data = [{ alg: 'HS256' }, { ...actor, exp: Date.now()/1000+3600, ...overrides }].map(v => Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');
  return 'Bearer ' + data + '.' + createHmac('sha256', secret).update(data).digest('base64url');
}
beforeEach(() => { process.env.JWT_SECRET = 'session-test-secret'; jest.clearAllMocks(); for (const client of clients()) client.user.findUnique.mockResolvedValue(actor); });
test('accepts the current database identity', async () => { expect(await authenticate(token())).toEqual(actor); });
test.each([undefined, 'Bearer', token({}, 'wrong-secret'), token({ exp: undefined }), token({ exp: 0 }), token({ nbf: Date.now()/1000+100 }), token({ id: 'not-a-uuid' }), token({ tenantId: '33333333-3333-4333-8333-333333333333' }), token({ role: 'SUPER_ADMIN' })])('rejects invalid or stale session %#', async authorization => { await expect(authenticate(authorization)).rejects.toMatchObject({ status: 401 }); });
test('deleted users and changed roles invalidate sessions', async () => {
  for (const value of [null, { ...actor, role: 'TECHNICIAN' }]) {
    for (const client of clients()) client.user.findUnique.mockResolvedValue(value);
    await expect(authenticate(token())).rejects.toMatchObject({ status: 401 });
  }
});
test('customer queries ignore untrusted tenant selectors and hide foreign IDs', async () => {
  const req: any = { user: actor, headers: { 'x-tenant-id': 'foreign' }, params: { id: 'foreign-customer' } };
  const reply: any = { send: jest.fn(), json: jest.fn(), status: jest.fn().mockReturnThis() };
  for (const client of clients()) { client.customer.findMany.mockResolvedValue([]); client.customer.findFirst.mockResolvedValue(null); }
  await getCustomers(req, reply); await getCustomer(req, reply);
  const db = clients().find(c => c.customer.findMany.mock.calls.length);
  expect(db.customer.findMany.mock.calls[0][0].where).toEqual({ user: { tenantId: actor.tenantId } });
  expect(db.customer.findFirst.mock.calls[0][0].where).toEqual({ id: 'foreign-customer', user: { tenantId: actor.tenantId } });
  expect(reply.status).toHaveBeenCalledWith(404);
});
test('sensitive route policies require managers; canonical commands retain ownership checks', () => {
  expect(requiredRoles('/api/v1/hr/staff')).toEqual(['SUPER_ADMIN','MANAGER']);
  expect(requiredRoles('/api/finance/invoices')).toEqual(['SUPER_ADMIN','MANAGER']);
  expect(requiredRoles('/api/v1/customers')).not.toContain('TECHNICIAN');
  expect(requiredRoles('/api/v1/callbacks')).toBeNull();
});
test('events only reach the explicitly attributed tenant', () => {
  const a: any = { raw: { write: jest.fn() }, write: jest.fn() }, b: any = { raw: { write: jest.fn() }, write: jest.fn() };
  const bus: any = eventBus, subscribe = bus.subscribe ? 'subscribe' : 'addClient', remove = bus.unsubscribe ? 'unsubscribe' : 'removeClient';
  bus[subscribe](a, actor.tenantId); bus[subscribe](b, 'foreign');
  bus.broadcast('test', { tenantId: 'foreign' }, actor.tenantId); bus.broadcast('unattributed', {});
  expect(a.raw.write.mock.calls.length + a.write.mock.calls.length).toBe(1);
  expect(b.raw.write.mock.calls.length + b.write.mock.calls.length).toBe(0);
  bus[remove](a); bus[remove](b);
});
