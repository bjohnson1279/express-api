const mockActor: jest.Mock = jest.fn(() => ({ id: 'u-1', tenantId: 't-1', role: 'MANAGER' }));
const mockCmd: jest.Mock = jest.fn();

class MockCallbackError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

jest.mock('../src/domains/crm/callbackService', () => ({
  callbackActor: (...args: any[]) => mockActor(...args),
  CallbackError: MockCallbackError,
  callbackCommand: (...args: any[]) => mockCmd(...args),
}));
jest.mock('../src/domains/crm/commercialService', () => ({
  callbackActor: (...args: any[]) => mockActor(...args),
  CallbackError: MockCallbackError,
  commercialCommand: (...args: any[]) => mockCmd(...args),
}));
jest.mock('../src/domains/crm/catalogService', () => ({
  callbackActor: (...args: any[]) => mockActor(...args),
  CallbackError: MockCallbackError,
  catalogCommand: (...args: any[]) => mockCmd(...args),
}));
jest.mock('../src/domains/crm/deviceService', () => ({
  callbackActor: (...args: any[]) => mockActor(...args),
  CallbackError: MockCallbackError,
  deviceCommand: (...args: any[]) => mockCmd(...args),
}));
jest.mock('../src/domains/crm/inspectionService', () => ({
  callbackActor: (...args: any[]) => mockActor(...args),
  CallbackError: MockCallbackError,
  inspectionCommand: (...args: any[]) => mockCmd(...args),
}));
jest.mock('../src/domains/crm/profitabilityService', () => ({
  callbackActor: (...args: any[]) => mockActor(...args),
  CallbackError: MockCallbackError,
  profitabilityCommand: (...args: any[]) => mockCmd(...args),
}));
jest.mock('../src/domains/crm/recurringService', () => ({
  callbackActor: (...args: any[]) => mockActor(...args),
  CallbackError: MockCallbackError,
  recurringCommand: (...args: any[]) => mockCmd(...args),
}));

import Fastify from 'fastify';
import callbackRoutes from '../src/domains/crm/callbackRoutes';
import commercialRoutes from '../src/domains/crm/commercialRoutes';
import catalogRoutes from '../src/domains/crm/catalogRoutes';
import deviceRoutes from '../src/domains/crm/deviceRoutes';
import inspectionRoutes from '../src/domains/crm/inspectionRoutes';
import profitabilityRoutes from '../src/domains/crm/profitabilityRoutes';
import recurringRoutes from '../src/domains/crm/recurringRoutes';

describe('CRM Feature Fastify Route Plugins (Express)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers and dispatches callback, commercial, catalog, device, inspection, profitability, and recurring routes', async () => {
    const app = Fastify();
    await app.register(callbackRoutes, { prefix: '/callbacks' });
    await app.register(commercialRoutes, { prefix: '/commercial' });
    await app.register(catalogRoutes, { prefix: '/catalog' });
    await app.register(deviceRoutes, { prefix: '/devices' });
    await app.register(inspectionRoutes, { prefix: '/inspections' });
    await app.register(profitabilityRoutes, { prefix: '/profitability' });
    await app.register(recurringRoutes, { prefix: '/recurring' });

    mockCmd.mockResolvedValue({ ok: true });

    for (const [method, url] of [
      ['GET', '/callbacks/'],
      ['POST', '/callbacks/'],
      ['GET', '/callbacks/settings'],
      ['POST', '/callbacks/cb-1/resolution'],
      ['GET', '/commercial/'],
      ['POST', '/commercial/'],
      ['GET', '/commercial/settings'],
      ['GET', '/catalog/'],
      ['POST', '/catalog/'],
      ['GET', '/devices/'],
      ['POST', '/devices/'],
      ['GET', '/inspections/'],
      ['POST', '/inspections/'],
      ['GET', '/profitability/'],
      ['POST', '/profitability/policies'],
      ['GET', '/recurring/'],
      ['POST', '/recurring/assess'],
    ] as const) {
      const res = await app.inject({
        method,
        url,
        headers: { authorization: 'Bearer tok' },
        payload: method === 'POST' ? { name: 'Test' } : undefined,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ ok: true });
    }

    mockCmd.mockRejectedValueOnce(new MockCallbackError(403, 'Forbidden'));
    const rErr = await app.inject({ method: 'GET', url: '/commercial/' });
    expect(rErr.statusCode).toBe(403);
    expect(rErr.json()).toEqual({ error: 'Forbidden' });

    mockCmd.mockRejectedValueOnce(new Error('Crash'));
    const r500 = await app.inject({ method: 'GET', url: '/callbacks/' });
    expect(r500.statusCode).toBe(500);

    await app.close();
  });
});
