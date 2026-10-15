jest.setTimeout(60000);
import Fastify from 'fastify';
import jwt from 'jsonwebtoken';
import { hashPassword, verifyPassword } from '../src/shared/auth/password';
jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn(() => ({ user: { findUnique: jest.fn(), update: jest.fn() } })) }));
import { PrismaClient } from '@prisma/client';
import authRoutes from '../src/shared/auth/authRoutes';
const clients = (PrismaClient as jest.Mock).mock.results;
const findUnique = clients[clients.length - 1].value.user.findUnique;
beforeEach(() => { for (const client of clients) client.value.user.findUnique = findUnique; });
const actor = { id: '11111111-1111-4111-8111-111111111111', tenantId: '22222222-2222-4222-8222-222222222222', role: 'MANAGER', email: 'staff@example.com' };
beforeEach(() => { process.env.JWT_SECRET = 'test-only-auth-secret'; findUnique.mockReset(); });
test('password verification rejects placeholders and incorrect passwords', async () => {
  const hash = await hashPassword('correct password');
  expect(await verifyPassword('correct password', hash)).toBe(true);
  expect(await verifyPassword('wrong password', hash)).toBe(false);
  expect(await verifyPassword('hashed_pass', 'hashed_pass')).toBe(false);
});
test('login issues a bounded signed session and me validates the stored actor', async () => {
  const app = Fastify(); await app.register(authRoutes, { prefix: '/auth' });
  findUnique.mockResolvedValue({ ...actor, passwordHash: await hashPassword('correct password') });
  const response = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: actor.email, password: 'correct password' } });
  expect(response.statusCode).toBe(200);
  const body = response.json(); expect(body.user.passwordHash).toBeUndefined();
  const claims = jwt.verify(body.token, process.env.JWT_SECRET!) as jwt.JwtPayload;
  expect(claims.exp! - claims.iat!).toBe(3600);
  expect((await app.inject({ url: '/auth/me', headers: { authorization: 'Bearer ' + body.token } })).statusCode).toBe(200);
  findUnique.mockResolvedValue(null);
  expect((await app.inject({ url: '/auth/me', headers: { authorization: 'Bearer ' + body.token } })).statusCode).toBe(401);
  await app.close();
});
test('missing, incorrect, placeholder and non-staff credentials fail closed', async () => {
  const app = Fastify(); await app.register(authRoutes, { prefix: '/auth' });
  expect((await app.inject({ url: '/auth/me' })).statusCode).toBe(401);
  for (const user of [null, { ...actor, passwordHash: 'hashed_pass' }, { ...actor, role: 'CUSTOMER', passwordHash: await hashPassword('correct password') }]) {
    findUnique.mockResolvedValue(user);
    expect((await app.inject({ method: 'POST', url: '/auth/login', payload: { email: actor.email, password: 'correct password' } })).statusCode).toBe(401);
  }
  delete process.env.JWT_SECRET;
  expect((await app.inject({ method: 'POST', url: '/auth/login', payload: { email: actor.email, password: 'correct password' } })).statusCode).toBe(503);
  await app.close();
});
test('credential attempts are rate limited', async () => {
  const app = Fastify(); await app.register(authRoutes, { prefix: '/auth' });
  findUnique.mockResolvedValue(null);
  for (let i = 0; i < 10; i++) await app.inject({ method: 'POST', url: '/auth/login', payload: {} });
  expect((await app.inject({ method: 'POST', url: '/auth/login', payload: {} })).statusCode).toBe(429);
  await app.close();
});
