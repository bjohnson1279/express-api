import { EventEmitter } from 'events';

const mockStripe = {
  customers: { create: jest.fn() },
  paymentIntents: { create: jest.fn() },
  paymentMethods: { list: jest.fn() },
  webhooks: { constructEvent: jest.fn() },
};

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => mockStripe);
});

const mockHttpsGet = jest.fn();
jest.mock('https', () => ({
  get: (...args: any[]) => mockHttpsGet(...args),
}));

const mPrismaClient: any = {
  chemicalApplicationLog: { create: jest.fn() },
  inventoryItem: { findFirst: jest.fn(), update: jest.fn() },
  purchaseOrder: { findFirst: jest.fn(), create: jest.fn() },
  invoice: { findMany: jest.fn(), update: jest.fn() },
  payment: { create: jest.fn() },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mPrismaClient),
}));

import { stripeService } from '../src/domains/billing/stripeService';
import { stripeWebhook } from '../src/domains/billing/webhookController';
import { processAutoCharges } from '../src/domains/billing/autoCharge';
import { ClimateService } from '../src/domains/analytics/ClimateService';
import { recordChemicalApplication } from '../src/domains/dispatch/inventoryController';

function mockReply() {
  const reply: any = {
    statusCode: 200,
    body: undefined,
    status(c: number) {
      this.statusCode = c;
      return this;
    },
    send(b: any) {
      this.body = b;
      return this;
    },
  };
  return reply;
}

describe('StripeService, ClimateService HTTP/Cache, and Chemical Auto-Deduction (Express)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('stripeService', () => {
    it('creates customers, payment intents, constructs webhook events, and charges saved cards', async () => {
      mockStripe.customers.create.mockResolvedValueOnce({ id: 'cus_1' });
      expect(await stripeService.createCustomer('a@b.com', 'Alice')).toEqual({ id: 'cus_1' });

      mockStripe.paymentIntents.create.mockResolvedValueOnce({ id: 'pi_1' });
      expect(await stripeService.createPaymentIntent(1500, 'usd', 'cus_1')).toEqual({ id: 'pi_1' });

      mockStripe.webhooks.constructEvent.mockReturnValueOnce({ type: 'payment_intent.succeeded' });
      expect(stripeService.constructEvent(Buffer.from('{}'), 'sig')).toEqual({ type: 'payment_intent.succeeded' });

      mockStripe.paymentMethods.list.mockResolvedValueOnce({ data: [{ id: 'pm_1' }] });
      mockStripe.paymentIntents.create.mockResolvedValueOnce({ id: 'pi_2', status: 'succeeded' });
      expect(await stripeService.chargeCustomer('cus_1', 2500)).toEqual({ id: 'pi_2', status: 'succeeded' });

      mockStripe.paymentMethods.list.mockResolvedValueOnce({ data: [] });
      await expect(stripeService.chargeCustomer('cus_empty', 1000)).rejects.toThrow('No payment methods found');
    });

    it('validates stripeWebhook signatures and processes payment_intent events', () => {
      const rMissing = mockReply();
      stripeWebhook({ headers: {}, body: {} } as any, rMissing);
      expect(rMissing.statusCode).toBe(400);

      mockStripe.webhooks.constructEvent.mockImplementationOnce(() => {
        throw new Error('Bad signature');
      });
      const rBad = mockReply();
      stripeWebhook({ headers: { 'stripe-signature': 't=1,v1=bad' }, body: '{}' } as any, rBad);
      expect(rBad.statusCode).toBe(400);

      mockStripe.webhooks.constructEvent.mockReturnValueOnce({
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_1' } },
      });
      const rOk = mockReply();
      stripeWebhook({ headers: { 'stripe-signature': 't=1,v1=good' }, body: '{}' } as any, rOk);
      expect(rOk.statusCode).toBe(200);
      expect(rOk.body).toEqual({ received: true });
    });

    it('processes auto-charges for unpaid invoices and records completed payments', async () => {
      mPrismaClient.invoice.findMany.mockResolvedValueOnce([
        { id: 'inv-1', totalAmount: 125.0, job: { customerId: 'cust-1' } },
        { id: 'inv-2', totalAmount: 80.0, job: { customerId: 'cust-2' } },
      ]);
      mockStripe.paymentIntents.create
        .mockResolvedValueOnce({ id: 'pi_auto_1' })
        .mockRejectedValueOnce(new Error('Card declined'));
      mPrismaClient.payment.create.mockResolvedValueOnce({ id: 'pmt-1' });
      mPrismaClient.invoice.update.mockResolvedValueOnce({ id: 'inv-1', status: 'paid' });

      const summary = await processAutoCharges(mPrismaClient);
      expect(summary).toEqual({ processed: 2, succeeded: 1, failed: 1 });
      expect(mPrismaClient.payment.create).toHaveBeenCalledTimes(1);
      expect(mPrismaClient.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { status: 'paid' },
      });
    });
  });

  describe('ClimateService.getClimateData', () => {
    it('fetches live Open-Meteo data, caches subsequent lookups, and falls back on errors/timeouts', async () => {
      mockHttpsGet.mockImplementationOnce((_url: string, _opts: any, cb: (res: any) => void) => {
        const res = new EventEmitter() as any;
        res.statusCode = 200;
        const req = new EventEmitter() as any;
        req.destroy = jest.fn();
        process.nextTick(() => {
          cb(res);
          res.emit(
            'data',
            JSON.stringify({
              current: {
                temperature_2m: 84,
                relative_humidity_2m: 65,
                precipitation: 0.1,
                wind_speed_10m: 7,
                weather_code: 2,
              },
            })
          );
          res.emit('end');
        });
        return req;
      });

      const live = await ClimateService.getClimateData(34.1234, -118.4567);
      expect(live.source).toBe('open-meteo');
      expect(live.cached).toBe(false);
      expect(live.temperature).toBe(84);

      const cached = await ClimateService.getClimateData(34.1234, -118.4567);
      expect(cached.cached).toBe(true);
      expect(mockHttpsGet).toHaveBeenCalledTimes(1);

      // Non-200 status -> fallback
      mockHttpsGet.mockImplementationOnce((_url: string, _opts: any, cb: (res: any) => void) => {
        const res = new EventEmitter() as any;
        res.statusCode = 503;
        const req = new EventEmitter() as any;
        req.destroy = jest.fn();
        process.nextTick(() => cb(res));
        return req;
      });
      const fbStatus = await ClimateService.getClimateData(30.0, -90.0);
      expect(fbStatus.source).toBe('offline-ambient-fallback');

      // Network error -> fallback
      mockHttpsGet.mockImplementationOnce(() => {
        const req = new EventEmitter() as any;
        req.destroy = jest.fn();
        process.nextTick(() => req.emit('error', new Error('ECONNRESET')));
        return req;
      });
      const fbErr = await ClimateService.getClimateData(31.0, -91.0);
      expect(fbErr.source).toBe('offline-ambient-fallback');

      // Timeout -> destroy & fallback
      mockHttpsGet.mockImplementationOnce(() => {
        const req = new EventEmitter() as any;
        req.destroy = jest.fn();
        process.nextTick(() => req.emit('timeout'));
        return req;
      });
      const fbTimeout = await ClimateService.getClimateData(32.0, -92.0);
      expect(fbTimeout.source).toBe('offline-ambient-fallback');
    });
  });

  describe('inventoryController.recordChemicalApplication', () => {
    it('validates required fields and auto-deducts inventory + drafts PO when below threshold', async () => {
      const rBad = mockReply();
      await recordChemicalApplication({ user: { tenantId: 't-1' }, body: { chemicalName: 'Termidor' } } as any, rBad);
      expect(rBad.statusCode).toBe(400);

      mPrismaClient.chemicalApplicationLog.create.mockResolvedValueOnce({ id: 'log-1', chemicalName: 'Termidor SC' });
      mPrismaClient.inventoryItem.findFirst.mockResolvedValueOnce({ id: 'item-1' });
      mPrismaClient.inventoryItem.update.mockResolvedValueOnce({
        id: 'item-1',
        tenantId: 't-1',
        quantity: 2,
        minimumThreshold: 10,
      });
      mPrismaClient.purchaseOrder.findFirst.mockResolvedValueOnce(null);
      mPrismaClient.purchaseOrder.create.mockResolvedValueOnce({ id: 'po-1' });

      const rOk = mockReply();
      await recordChemicalApplication(
        {
          user: { tenantId: 't-1' },
          body: {
            jobId: 'job-1',
            technicianId: 'tech-1',
            chemicalName: 'Termidor SC',
            quantityUsed: '2.5',
            unit: 'oz',
            targetPests: ['Termites'],
          },
        } as any,
        rOk
      );

      expect(rOk.statusCode).toBe(201);
      expect(rOk.body.autoPoCreated).toBe(true);
      expect(mPrismaClient.purchaseOrder.create).toHaveBeenCalledTimes(1);
    });
  });
});
