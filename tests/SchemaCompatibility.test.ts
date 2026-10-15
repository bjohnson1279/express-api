jest.mock('@prisma/client', () => {
  const client: any = {
    customer: { findUnique: jest.fn() }, invoice: { count: jest.fn() }, job: { findFirst: jest.fn() },
    customerHealthScore: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
    property: { findFirst: jest.fn() }, propertyPestRiskScore: { create: jest.fn() }, $queryRaw: jest.fn()
  };
  client.$transaction = jest.fn((callback: any) => callback(client));
  return { PrismaClient: jest.fn(() => client) };
});
jest.mock('../src/domains/analytics/ClimateService', () => ({ ClimateService: { getClimateData: jest.fn(async () => ({ temperature: 70, relativeHumidity: 50, precipitation: 0, source: 'test', conditionSummary: 'Clear' })) } }));
import { PrismaClient } from '@prisma/client';
import { HealthScoreService } from '../src/domains/crm/HealthScoreService';
import { PestRiskService } from '../src/domains/analytics/pestRiskService';
const client = (PrismaClient as jest.Mock).mock.results[0].value;
beforeEach(() => {
  jest.clearAllMocks();
  client.customer.findUnique.mockResolvedValue({ id: 'customer' });
  client.invoice.count.mockResolvedValue(0); client.job.findFirst.mockResolvedValue(null);
  client.customerHealthScore.create.mockResolvedValue({ id: 'created' });
  client.customerHealthScore.update.mockResolvedValue({ id: 'updated' });
});
test('refresh updates the latest health score by its real primary key', async () => {
  client.customerHealthScore.findFirst.mockResolvedValue({ id: 'existing' });
  await new HealthScoreService().calculateForCustomer('customer');
  expect(client.$queryRaw).toHaveBeenCalled();
  expect(client.customerHealthScore.findFirst).toHaveBeenCalledWith({ where: { customerId: 'customer' }, orderBy: [{ calculatedAt: 'desc' }, { id: 'desc' }] });
  expect(client.customerHealthScore.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'existing' } }));
  expect(client.customerHealthScore.create).not.toHaveBeenCalled();
});
test('refresh creates the first score while holding the customer lock', async () => {
  client.customerHealthScore.findFirst.mockResolvedValue(null);
  await new HealthScoreService().calculateForCustomer('customer');
  expect(client.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(client.customerHealthScore.create.mock.invocationCallOrder[0]);
  expect(client.customerHealthScore.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ customerId: 'customer' }) }));
});
test.each([false, true])('undated chemical applications do not become epoch dates (dated=%s)', async dated => {
  const logs: any[] = [{ appliedAt: null, chemicalName: 'Undated' }];
  if (dated) logs.push({ appliedAt: new Date(Date.now() - 10 * 86400000), chemicalName: 'Known' });
  client.property.findFirst.mockResolvedValue({ id: 'property', address: 'Test', photos: [], jobs: [{ chemicalLogs: logs }], lat: null, lng: null });
  const result = await PestRiskService.calculatePropertyRisk('property', 'tenant');
  expect(result.factors?.daysSinceLastTreatment).toBe(dated ? 10 : 90);
  expect(Number.isFinite(result.overallRiskScore)).toBe(true);
});
