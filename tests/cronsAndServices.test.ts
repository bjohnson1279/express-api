const scheduledTasks: Array<{ expr: string; fn: () => Promise<void> }> = [];
jest.mock('../src/shared/scheduler', () => ({
  __esModule: true,
  default: {
    schedule: jest.fn((expr: string, fn: () => Promise<void>) => {
      scheduledTasks.push({ expr, fn });
    }),
  },
}));

const mPrismaClient: any = {
  serviceContract: {
    findMany: jest.fn(),
  },
  job: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
  customerEmail: {
    findFirst: jest.fn(),
  },
  notificationQueue: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  customer: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  invoice: {
    count: jest.fn(),
  },
  customerHealthScore: {
    findFirst: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  property: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  propertyPestRiskScore: {
    create: jest.fn(),
  },
  $queryRaw: jest.fn().mockResolvedValue([{ id: 'c-1' }]),
  $transaction: jest.fn(async (cb: any) => cb(mPrismaClient)),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mPrismaClient),
  ContractCadence: {
    MONTHLY: 'MONTHLY',
    BI_MONTHLY: 'BI_MONTHLY',
    QUARTERLY: 'QUARTERLY',
    SEMI_ANNUALLY: 'SEMI_ANNUALLY',
    ANNUALLY: 'ANNUALLY',
    ONE_TIME: 'ONE_TIME',
  },
}));

const mockGetClimateData = jest.fn();
jest.mock('../src/domains/analytics/ClimateService', () => ({
  ClimateService: {
    getClimateData: (...args: any[]) => mockGetClimateData(...args),
  },
}));

import { startJobGenerationCron } from '../src/domains/dispatch/JobGenerationCron';
import { startPreVisitNotificationCron } from '../src/domains/comms/PreVisitNotificationCron';
import { startHealthScoreCron } from '../src/domains/crm/HealthScoreCron';
import { HealthScoreService } from '../src/domains/crm/HealthScoreService';
import { RoutingService } from '../src/domains/dispatch/RoutingService';
import { PestRiskService } from '../src/domains/analytics/pestRiskService';

describe('Crons, HealthScore, Routing, and PestRisk Services (Express)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    scheduledTasks.length = 0;
  });

  describe('JobGenerationCron', () => {
    it('generates jobs and email notifications for upcoming active contracts', async () => {
      startJobGenerationCron();
      expect(scheduledTasks).toHaveLength(1);

      const soon = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const pastMonthly = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
      const pastOneTime = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

      mPrismaClient.serviceContract.findMany.mockResolvedValueOnce([
        {
          id: 'sc-1',
          tenantId: 't-1',
          customerId: 'c-1',
          propertyId: 'p-1',
          cadence: 'MONTHLY',
          startDate: pastMonthly,
          customer: { name: 'Alice' },
        },
        {
          id: 'sc-2',
          tenantId: 't-1',
          customerId: 'c-2',
          propertyId: 'p-2',
          cadence: 'QUARTERLY',
          startDate: soon,
          customer: { name: 'Bob' },
        },
        {
          id: 'sc-3',
          tenantId: 't-1',
          customerId: 'c-3',
          propertyId: 'p-3',
          cadence: 'ONE_TIME',
          startDate: pastOneTime,
          customer: { name: 'Charlie' },
        },
      ]);

      mPrismaClient.job.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'existing-job' });
      mPrismaClient.job.create.mockResolvedValueOnce({ id: 'new-job-1' });
      mPrismaClient.customerEmail.findFirst.mockResolvedValueOnce({ emailAddress: 'alice@example.com' });
      mPrismaClient.notificationQueue.create.mockResolvedValueOnce({ id: 'nq-1' });

      await scheduledTasks[0].fn();

      expect(mPrismaClient.job.create).toHaveBeenCalledTimes(1);
      expect(mPrismaClient.notificationQueue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            jobId: 'new-job-1',
            channel: 'EMAIL',
            contactTarget: 'alice@example.com',
          }),
        })
      );
    });
  });

  describe('PreVisitNotificationCron', () => {
    it('queues SMS for opted-in phone, EMAIL fallback, and skips duplicates or missing contact', async () => {
      startPreVisitNotificationCron();
      expect(scheduledTasks).toHaveLength(1);

      const start = new Date(Date.now() + 48.5 * 60 * 60 * 1000);
      mPrismaClient.job.findMany.mockResolvedValueOnce([
        {
          id: 'j-1',
          tenantId: 't-1',
          customerId: 'c-1',
          scheduledStart: start,
          customer: {
            phones: [{ phoneNumber: '+15551234', receivesSms: true }],
            emails: [{ emailAddress: 'c1@example.com' }],
          },
        },
        {
          id: 'j-2',
          tenantId: 't-1',
          customerId: 'c-2',
          scheduledStart: start,
          customer: {
            phones: [{ phoneNumber: '+15550000', receivesSms: false }],
            emails: [{ emailAddress: 'c2@example.com' }],
          },
        },
        {
          id: 'j-3',
          tenantId: 't-1',
          customerId: 'c-3',
          scheduledStart: start,
          customer: { phones: [], emails: [] },
        },
      ]);

      mPrismaClient.notificationQueue.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mPrismaClient.notificationQueue.create.mockResolvedValue({});

      await scheduledTasks[0].fn();

      expect(mPrismaClient.notificationQueue.create).toHaveBeenCalledTimes(2);
      expect(mPrismaClient.notificationQueue.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          data: expect.objectContaining({ jobId: 'j-1', channel: 'SMS', contactTarget: '+15551234' }),
        })
      );
      expect(mPrismaClient.notificationQueue.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          data: expect.objectContaining({ jobId: 'j-2', channel: 'EMAIL', contactTarget: 'c2@example.com' }),
        })
      );
    });
  });

  describe('HealthScoreService & HealthScoreCron', () => {
    it('computes high-risk score for unpaid invoices + >12mo inactivity and creates record', async () => {
      const svc = new HealthScoreService();
      mPrismaClient.customer.findUnique.mockResolvedValueOnce({ id: 'c-1' });
      mPrismaClient.invoice.count.mockResolvedValueOnce(3);
      mPrismaClient.job.findFirst.mockResolvedValueOnce({
        scheduledStart: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
      });
      mPrismaClient.customerHealthScore.findFirst.mockResolvedValueOnce(null);
      mPrismaClient.customerHealthScore.create.mockImplementationOnce(({ data }: any) => Promise.resolve(data));

      const result = await svc.calculateForCustomer('c-1');
      expect(result.score).toBe(25);
      expect(result.riskLevel).toBe('high');
      expect(mPrismaClient.customerHealthScore.create).toHaveBeenCalledTimes(1);
    });

    it('updates existing health score for medium-risk customer with no completed jobs', async () => {
      const svc = new HealthScoreService();
      mPrismaClient.customer.findUnique.mockResolvedValueOnce({ id: 'c-2' });
      mPrismaClient.invoice.count.mockResolvedValueOnce(1);
      mPrismaClient.job.findFirst.mockResolvedValueOnce(null);
      mPrismaClient.customerHealthScore.findFirst.mockResolvedValueOnce({ id: 'hs-1' });
      mPrismaClient.customerHealthScore.update.mockImplementationOnce(({ data }: any) => Promise.resolve(data));

      const result = await svc.calculateForCustomer('c-2');
      expect(result.score).toBe(75);
      expect(result.riskLevel).toBe('medium');
      expect(mPrismaClient.customerHealthScore.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'hs-1' } })
      );
    });

    it('throws when customer is not found', async () => {
      const svc = new HealthScoreService();
      mPrismaClient.customer.findUnique.mockResolvedValueOnce(null);
      await expect(svc.calculateForCustomer('missing')).rejects.toThrow('Customer with ID missing not found');
    });

    it('HealthScoreCron runs calculateForAllCustomers over customer list', async () => {
      startHealthScoreCron();
      expect(scheduledTasks).toHaveLength(1);
      mPrismaClient.customer.findMany.mockResolvedValueOnce([{ id: 'c-1' }, { id: 'c-missing' }]);
      mPrismaClient.customer.findUnique
        .mockResolvedValueOnce({ id: 'c-1' })
        .mockResolvedValueOnce(null);
      mPrismaClient.invoice.count.mockResolvedValueOnce(0);
      mPrismaClient.job.findFirst.mockResolvedValueOnce({
        scheduledStart: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      });
      mPrismaClient.customerHealthScore.findFirst.mockResolvedValueOnce(null);
      mPrismaClient.customerHealthScore.create.mockResolvedValueOnce({ score: 100, riskLevel: 'low' });

      await scheduledTasks[0].fn();
      expect(mPrismaClient.customerHealthScore.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('RoutingService', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('optimizes route order via OSRM trip API', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 'Ok',
          waypoints: [
            { waypoint_index: 1, name: 'Stop B' },
            { waypoint_index: 0, name: 'Start A' },
          ],
          trips: [{ duration: 600, distance: 5200, geometry: 'abc123' }],
        }),
      }) as any;

      const svc = new RoutingService();
      const res = await svc.optimizeRoute([
        [-118.24, 34.05],
        [-118.3, 34.08],
      ]);

      expect(res.success).toBe(true);
      expect(res.sequence[0].name).toBe('Start A');
      expect(res.duration).toBe(600);
      expect(res.distance).toBe(5200);
    });

    it('throws on non-OK HTTP response or non-Ok OSRM code', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Gateway',
      }) as any;
      const svc = new RoutingService();
      await expect(svc.optimizeRoute([[0, 0], [1, 1]])).rejects.toThrow('OSRM API error: Bad Gateway');

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ code: 'NoRoute' }),
      }) as any;
      await expect(svc.optimizeRoute([[0, 0], [1, 1]])).rejects.toThrow('OSRM routing failed: NoRoute');
    });
  });

  describe('PestRiskService', () => {
    it('classifies all four seasonal vectors', () => {
      expect(PestRiskService.getSeasonalVector(3).vector).toBe('SPRING_EMERGENCE');
      expect(PestRiskService.getSeasonalVector(6).vector).toBe('SUMMER_PEAK');
      expect(PestRiskService.getSeasonalVector(9).vector).toBe('FALL_NESTING');
      expect(PestRiskService.getSeasonalVector(0).vector).toBe('WINTER_DORMANCY');
    });

    it('calculates critical termite risk with moisture/wood vulnerabilities and persists score', async () => {
      mockGetClimateData.mockResolvedValueOnce({
        temperature: 90,
        relativeHumidity: 78,
        precipitation: 0.4,
        windSpeed: 10,
        conditionSummary: 'Rain',
        source: 'open-meteo',
      });
      mPrismaClient.property.findFirst.mockResolvedValueOnce({
        id: 'prop-1',
        address: '100 Oak St',
        lat: 34.05,
        lng: -118.24,
        photos: [{ tags: ['moisture', 'wood rot'] }],
        jobs: [
          {
            chemicalLogs: [
              {
                appliedAt: new Date(Date.now() - 80 * 24 * 60 * 60 * 1000),
                targetPests: ['Subterranean Termites'],
                chemicalName: 'Termidor SC',
              },
            ],
          },
        ],
      });
      mPrismaClient.propertyPestRiskScore.create.mockResolvedValueOnce({});

      const prediction = await PestRiskService.calculatePropertyRisk('prop-1', 't-1');
      expect(prediction.riskLevel).toBe('CRITICAL');
      expect(prediction.primaryTargetPest).toBe('Subterranean Termites');
      expect(prediction.overallRiskScore).toBeGreaterThanOrEqual(85);
      expect(prediction.upsellRecommendation).toContain('Termite Bait Station');
      expect(mPrismaClient.propertyPestRiskScore.create).toHaveBeenCalledTimes(1);
    });

    it('returns heatmap data using cached scores and dynamically computing missing ones', async () => {
      mPrismaClient.property.findMany.mockResolvedValueOnce([
        {
          id: 'prop-cached',
          address: '1 Cached Ave',
          lat: 35.0,
          lng: -119.0,
          pestRiskScores: [
            {
              overallRiskScore: 45,
              riskLevel: 'MEDIUM',
              primaryTargetPest: 'Carpenter Ants',
              resurgenceProbability: 42.3,
              daysToProjectedResurgence: 30,
              recommendedTreatment: 'Routine',
              upsellRecommendation: 'Bundle',
            },
          ],
        },
        {
          id: 'prop-new',
          address: '2 Fresh Rd',
          lat: null,
          lng: null,
          pestRiskScores: [],
        },
      ]);

      mockGetClimateData.mockResolvedValueOnce({
        temperature: 45,
        relativeHumidity: 30,
        precipitation: 0,
        windSpeed: 5,
        conditionSummary: 'Clear',
        source: 'fallback',
      });
      mPrismaClient.property.findFirst.mockResolvedValueOnce({
        id: 'prop-new',
        address: '2 Fresh Rd',
        lat: null,
        lng: null,
        photos: [],
        jobs: [
          {
            chemicalLogs: [
              {
                appliedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
                targetPests: ['German Cockroaches'],
                chemicalName: 'Advion',
              },
            ],
          },
        ],
      });
      mPrismaClient.propertyPestRiskScore.create.mockResolvedValueOnce({});

      const heatmap = await PestRiskService.getHeatmapData('t-1');
      expect(heatmap).toHaveLength(2);
      expect(heatmap[0].overallRiskScore).toBe(45);
      expect(heatmap[1].primaryTargetPest).toBe('German Cockroaches');
    });
  });
});
