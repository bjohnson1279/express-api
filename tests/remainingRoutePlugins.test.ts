const mockOptimizeRoute = jest.fn();
jest.mock('../src/domains/dispatch/RoutingService', () => ({
  RoutingService: jest.fn().mockImplementation(() => ({
    optimizeRoute: (...args: any[]) => mockOptimizeRoute(...args),
  })),
}));

const mockDashboardSummary = jest.fn();
jest.mock('../src/domains/analytics/dashboardService', () => ({
  dashboardSummary: (...args: any[]) => mockDashboardSummary(...args),
}));

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({})),
}));

import Fastify from 'fastify';
import analyticsRoutes from '../src/domains/analytics/analyticsRoutes';
import chatRoutes from '../src/domains/comms/chatRoutes';
import twilioRoutes from '../src/domains/comms/twilioRoutes';
import contractRoutes from '../src/domains/crm/contractRoutes';
import customerRoutes from '../src/domains/crm/customerRoutes';
import dispatchRoutes from '../src/domains/dispatch/dispatchRoutes';
import routingRoutes from '../src/domains/dispatch/routingRoutes';
import technicianRoutes from '../src/domains/dispatch/technicianRoutes';
import hrRoutes from '../src/domains/hr/hrRoutes';
import agreementRoutes from '../src/domains/sales/agreementRoutes';
import canvassRoutes from '../src/domains/sales/canvassRoutes';
import territoryRoutes from '../src/domains/sales/territoryRoutes';

describe('Remaining Fastify Route Plugins & Routing/Analytics Endpoints (Express)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers all domain route plugins cleanly and executes routing & dashboard handlers', async () => {
    const app = Fastify();
    await app.register(analyticsRoutes, { prefix: '/analytics' });
    await app.register(chatRoutes, { prefix: '/chat' });
    await app.register(twilioRoutes, { prefix: '/twilio' });
    await app.register(contractRoutes, { prefix: '/contracts' });
    await app.register(customerRoutes, { prefix: '/customers' });
    await app.register(dispatchRoutes, { prefix: '/dispatch' });
    await app.register(routingRoutes, { prefix: '/routing' });
    await app.register(technicianRoutes, { prefix: '/technicians' });
    await app.register(hrRoutes, { prefix: '/hr' });
    await app.register(agreementRoutes, { prefix: '/agreements' });
    await app.register(canvassRoutes, { prefix: '/canvass' });
    await app.register(territoryRoutes, { prefix: '/territories' });

    const rBad = await app.inject({ method: 'POST', url: '/routing/optimize', payload: {} });
    expect(rBad.statusCode).toBe(400);

    mockOptimizeRoute.mockResolvedValueOnce({ success: true, distance: 1200, duration: 300 });
    const rOk = await app.inject({
      method: 'POST',
      url: '/routing/optimize',
      payload: { coordinates: [[-118.2, 34.0], [-118.3, 34.1]] },
    });
    expect(rOk.statusCode).toBe(200);
    expect(rOk.json().distance).toBe(1200);

    mockOptimizeRoute.mockRejectedValueOnce(new Error('OSRM down'));
    const r500 = await app.inject({
      method: 'POST',
      url: '/routing/optimize',
      payload: { coordinates: [[0, 0], [1, 1]] },
    });
    expect(r500.statusCode).toBe(500);

    mockDashboardSummary.mockResolvedValueOnce({ activeJobs: 12 });
    const rDash = await app.inject({
      method: 'GET',
      url: '/analytics/dashboard',
      headers: { authorization: 'Bearer tok' },
    });
    expect(rDash.statusCode).toBe(200);
    expect(rDash.json().activeJobs).toBe(12);

    await app.close();
  });
});
