import { PrismaInvoiceRepository } from '../src/infrastructure/billing/PrismaInvoiceRepository';
import { PrismaPaymentRepository } from '../src/infrastructure/billing/PrismaPaymentRepository';
import { PrismaQuoteRepository } from '../src/infrastructure/billing/PrismaQuoteRepository';
import { PrismaCustomerRepository } from '../src/infrastructure/crm/PrismaCustomerRepository';
import { PrismaServiceAgreementRepository } from '../src/infrastructure/sales/PrismaServiceAgreementRepository';
import { PrismaTerritoryRepository } from '../src/infrastructure/sales/PrismaTerritoryRepository';

import { Invoice } from '../src/domain/billing/entities/Invoice';
import { Payment } from '../src/domain/billing/entities/Payment';
import { Quote } from '../src/domain/billing/entities/Quote';
import { Money } from '../src/domain/billing/valueObjects/Money';
import { PaymentMethod } from '../src/domain/billing/valueObjects/PaymentMethod';
import { Customer, EmailAddress, CommunicationPreferences, HealthScore } from '../src/domain/crm';
import { ServiceAgreement } from '../src/domain/sales/entities/ServiceAgreement';
import { Territory } from '../src/domain/sales/entities/Territory';
import { TerritoryPolygon } from '../src/domain/sales/valueObjects/TerritoryPolygon';

describe('Prisma Infrastructure Repositories (Express)', () => {
  it('PrismaInvoiceRepository maps findById, findByJobId, findOutstanding, findAll, and save', async () => {
    const row = {
      id: 'inv-1',
      jobId: 'job-1',
      totalAmount: 200,
      status: 'partially_paid',
      createdAt: new Date('2026-11-01T00:00:00Z'),
      job: { tenantId: 't-1', customerId: 'c-1', customer: { user: { tenantId: 't-1' } } },
      payments: [
        { status: 'completed', amount: 75 },
        { status: 'failed', amount: 50 },
      ],
    };
    const prisma: any = {
      invoice: {
        findFirst: jest.fn().mockResolvedValueOnce(row).mockResolvedValueOnce(null).mockResolvedValueOnce(row),
        findMany: jest.fn().mockResolvedValueOnce([row]).mockResolvedValueOnce([row]),
        upsert: jest.fn().mockResolvedValueOnce({}),
      },
    };

    const repo = new PrismaInvoiceRepository(prisma);
    const inv = await repo.findById('inv-1', 't-1');
    expect(inv?.id).toBe('inv-1');
    expect(inv?.remainingBalance.toDollars()).toBe(125);
    expect(await repo.findById('missing')).toBeNull();
    expect((await repo.findByJobId('job-1', 't-1'))?.jobId).toBe('job-1');
    expect(await repo.findOutstanding('t-1')).toHaveLength(1);
    expect(await repo.findAll('t-1', 'c-1')).toHaveLength(1);

    await repo.save(new Invoice('inv-1', 't-1', 'c-1', 'job-1', Money.fromDollars(200), Money.fromDollars(75), 'partially_paid'));
    expect(prisma.invoice.upsert).toHaveBeenCalledTimes(1);
  });

  it('PrismaPaymentRepository saves and lists payments', async () => {
    const prisma: any = {
      payment: {
        create: jest.fn().mockResolvedValueOnce({}),
        findMany: jest.fn().mockResolvedValueOnce([
          {
            id: 'pay-1',
            customerId: 'c-1',
            amount: 120,
            method: 'credit_card',
            status: 'completed',
            invoiceId: 'inv-1',
            externalTransactionId: 'txn-1',
            createdAt: new Date('2026-11-01T00:00:00Z'),
          },
        ]),
      },
    };
    const repo = new PrismaPaymentRepository(prisma);
    await repo.save(new Payment('pay-1', 't-1', 'c-1', Money.fromDollars(120), PaymentMethod.CREDIT_CARD, 'completed', 'inv-1', 'txn-1'));
    expect(prisma.payment.create).toHaveBeenCalledTimes(1);

    const all = await repo.findAll('t-1', 'c-1');
    expect(all).toHaveLength(1);
    expect(all[0].amount.toDollars()).toBe(120);
  });

  it('PrismaQuoteRepository maps findById, findAll, and save', async () => {
    const row = {
      id: 'q-1',
      customerId: 'c-1',
      propertyId: 'p-1',
      totalAmount: 350,
      status: 'sent',
      createdAt: new Date('2026-11-01T00:00:00Z'),
      customer: { user: { tenantId: 't-1' } },
    };
    const prisma: any = {
      quote: {
        findFirst: jest.fn().mockResolvedValueOnce(row).mockResolvedValueOnce(null),
        findMany: jest.fn().mockResolvedValueOnce([row]),
        upsert: jest.fn().mockResolvedValueOnce({}),
      },
    };
    const repo = new PrismaQuoteRepository(prisma);
    const q = await repo.findById('q-1', 't-1');
    expect(q?.totalAmount.toDollars()).toBe(350);
    expect(await repo.findById('missing')).toBeNull();
    expect(await repo.findAll('t-1', 'c-1')).toHaveLength(1);

    await repo.save(new Quote('q-1', 't-1', 'c-1', 'p-1', Money.fromDollars(350), 'sent'));
    expect(prisma.quote.upsert).toHaveBeenCalledTimes(1);
  });

  it('PrismaCustomerRepository maps findById, findAll, and save with preferences & healthScore', async () => {
    const row = {
      id: 'c-1',
      name: 'Alice',
      userId: 'u-1',
      user: { tenantId: 't-1', email: 'alice@example.com' },
      phones: [{ phoneNumber: '+15551234567' }],
      emails: [],
      properties: [{ id: 'p-1', customerId: 'c-1', address: '123 Main St', city: 'Austin', state: 'TX', zipCode: '78701' }],
      NotificationPreference: { smsEnabled: true, emailEnabled: true, voiceEnabled: false, pushEnabled: true },
      healthScore: [{ score: 92, factors: { ok: true }, calculatedAt: new Date('2026-11-01T00:00:00Z') }],
      createdAt: new Date('2026-10-01T00:00:00Z'),
    };
    const prisma: any = {
      customer: {
        findFirst: jest.fn().mockResolvedValueOnce(row).mockResolvedValueOnce(null),
        findMany: jest.fn().mockResolvedValueOnce([row]),
        update: jest.fn().mockResolvedValueOnce({}),
      },
      notificationPreference: { upsert: jest.fn().mockResolvedValueOnce({}) },
      customerHealthScore: { create: jest.fn().mockResolvedValueOnce({}) },
    };

    const repo = new PrismaCustomerRepository(prisma);
    const c = await repo.findById('c-1', 't-1');
    expect(c?.name).toBe('Alice');
    expect(c?.email?.value).toBe('alice@example.com');
    expect(c?.properties).toHaveLength(1);
    expect(c?.healthScore?.score).toBe(92);
    expect(await repo.findById('missing')).toBeNull();
    expect(await repo.findAll('t-1')).toHaveLength(1);

    const cust = new Customer({
      id: 'c-1',
      tenantId: 't-1',
      name: 'Alice Updated',
      email: new EmailAddress('alice@example.com'),
      preferences: new CommunicationPreferences({ smsEnabled: true, emailEnabled: false }),
      healthScore: new HealthScore(88, {}),
    });
    await repo.save(cust);
    expect(prisma.customer.update).toHaveBeenCalledTimes(1);
    expect(prisma.notificationPreference.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.customerHealthScore.create).toHaveBeenCalledTimes(1);
  });

  it('PrismaServiceAgreementRepository & PrismaTerritoryRepository map findById, findAll, and save', async () => {
    const agrRow = {
      id: 'agr-1',
      tenantId: 't-1',
      customerId: 'c-1',
      propertyId: 'p-1',
      cadence: 'MONTHLY',
      recurringAmount: 149,
      startDate: new Date('2026-12-01T00:00:00Z'),
      status: 'signed',
      signatureSvg: '<svg>sig</svg>',
      signedAt: new Date('2026-11-20T00:00:00Z'),
      pdfUrl: '/uploads/agr-1.pdf',
      contractId: 'sc-1',
      createdAt: new Date('2026-11-01T00:00:00Z'),
    };
    const terrRow = {
      id: 'terr-1',
      tenantId: 't-1',
      name: 'North Zone',
      description: 'Suburbs',
      assignedRepId: 'u-1',
      color: '#3b82f6',
      polygonCoordinates: JSON.stringify([
        { lat: 34.0, lng: -118.0 },
        { lat: 34.1, lng: -118.0 },
        { lat: 34.1, lng: -118.1 },
      ]),
      quotaTarget: 10000,
      isActive: true,
      createdAt: new Date('2026-11-01T00:00:00Z'),
    };

    const prisma: any = {
      serviceAgreement: {
        findFirst: jest.fn().mockResolvedValueOnce(agrRow).mockResolvedValueOnce(null),
        findMany: jest.fn().mockResolvedValueOnce([agrRow]),
        upsert: jest.fn().mockResolvedValueOnce({}),
      },
      territory: {
        findFirst: jest.fn().mockResolvedValueOnce(terrRow).mockResolvedValueOnce(null),
        findMany: jest.fn().mockResolvedValueOnce([terrRow]),
        upsert: jest.fn().mockResolvedValueOnce({}),
      },
    };

    const agrRepo = new PrismaServiceAgreementRepository(prisma);
    const agr = await agrRepo.findById('agr-1', 't-1');
    expect(agr?.status).toBe('signed');
    expect(await agrRepo.findById('missing')).toBeNull();
    expect(await agrRepo.findAll('t-1', 'c-1')).toHaveLength(1);
    await agrRepo.save(
      new ServiceAgreement({
        id: 'agr-1',
        tenantId: 't-1',
        customerId: 'c-1',
        propertyId: 'p-1',
        cadence: 'MONTHLY',
        recurringAmount: Money.fromDollars(149),
        startDate: new Date('2026-12-01T00:00:00Z'),
      })
    );
    expect(prisma.serviceAgreement.upsert).toHaveBeenCalledTimes(1);

    const terrRepo = new PrismaTerritoryRepository(prisma);
    const terr = await terrRepo.findById('terr-1', 't-1');
    expect(terr?.name).toBe('North Zone');
    expect(await terrRepo.findById('missing')).toBeNull();
    expect(await terrRepo.findAll('t-1')).toHaveLength(1);
    await terrRepo.save(
      new Territory({
        id: 'terr-1',
        tenantId: 't-1',
        name: 'North Zone',
        polygon: new TerritoryPolygon([
          { lat: 34.0, lng: -118.0 },
          { lat: 34.1, lng: -118.0 },
          { lat: 34.1, lng: -118.1 },
        ]),
        quotaTarget: Money.fromDollars(10000),
      })
    );
    expect(prisma.territory.upsert).toHaveBeenCalledTimes(1);
  });
});
