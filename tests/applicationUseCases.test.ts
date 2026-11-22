jest.mock('../src/domains/comms/eventBus', () => ({
  eventBus: { broadcast: jest.fn() },
}));

import { AcceptQuoteUseCase } from '../src/application/billing/AcceptQuoteUseCase';
import { GetFinancialReportUseCase } from '../src/application/billing/GetFinancialReportUseCase';
import { RecordPaymentUseCase } from '../src/application/billing/RecordPaymentUseCase';
import { CalculateCustomerHealthScoreUseCase } from '../src/application/crm/CalculateCustomerHealthScoreUseCase';
import { GetCustomerListUseCase } from '../src/application/crm/GetCustomerListUseCase';
import { GetCustomerProfileUseCase } from '../src/application/crm/GetCustomerProfileUseCase';
import { UpdateCustomerPreferencesUseCase } from '../src/application/crm/UpdateCustomerPreferencesUseCase';
import { GenerateAgreementUseCase } from '../src/application/sales/GenerateAgreementUseCase';
import { GetTerritoriesUseCase } from '../src/application/sales/GetTerritoriesUseCase';
import { SignAgreementUseCase } from '../src/application/sales/SignAgreementUseCase';

import { Money } from '../src/domain/billing/valueObjects/Money';
import {
  Customer,
  EmailAddress,
  PhoneNumber,
  Address,
  Property,
  CommunicationPreferences,
} from '../src/domain/crm';
import { eventBus } from '../src/domains/comms/eventBus';

function makeCustomer(): Customer {
  const prop = new Property(
    'prop-1',
    'c-1',
    new Address('100 Main St', 'Austin', 'TX', '78701')
  );
  return new Customer({
    id: 'c-1',
    tenantId: 't-1',
    name: 'Alice Customer',
    email: new EmailAddress('alice@example.com'),
    phone: new PhoneNumber('+15551234567'),
    properties: [prop],
    preferences: new CommunicationPreferences({
      smsEnabled: true,
      emailEnabled: true,
      voiceEnabled: false,
      pushEnabled: true,
    }),
    createdAt: new Date('2026-01-01T00:00:00Z'),
  });
}

describe('DDD Application Use Cases (Express)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('AcceptQuoteUseCase accepts quote, creates draft job, and broadcasts event', async () => {
    const fakeQuote: any = {
      id: 'q-1',
      tenantId: 't-1',
      customerId: 'c-1',
      propertyId: 'p-1',
      status: 'sent',
      totalAmount: Money.fromDollars(250),
      acceptedAt: undefined as Date | undefined,
      accept() {
        this.status = 'accepted';
        this.acceptedAt = new Date('2026-11-21T00:00:00Z');
      },
    };
    const quoteRepo: any = {
      findById: jest.fn().mockResolvedValueOnce(fakeQuote).mockResolvedValueOnce(null),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const prisma: any = {
      job: { create: jest.fn().mockResolvedValueOnce({ id: 'job-1', status: 'draft' }) },
    };

    const uc = new AcceptQuoteUseCase(quoteRepo, prisma);
    const res = await uc.execute({ quoteId: 'q-1', tenantId: 't-1' });
    expect(res.quote.status).toBe('accepted');
    expect(res.quote.totalAmount).toBe(250);
    expect(res.job.id).toBe('job-1');
    expect(eventBus.broadcast).toHaveBeenCalledWith('quote_accepted', expect.any(Object), 't-1');

    await expect(uc.execute({ quoteId: 'missing', tenantId: 't-1' })).rejects.toThrow('Quote missing not found');
  });

  it('GetFinancialReportUseCase computes MRR/ARR, commissions, and outstanding invoices', async () => {
    const prisma: any = {
      serviceContract: {
        findMany: jest.fn().mockResolvedValueOnce([
          { cadence: 'MONTHLY', recurringAmount: 100 },
          { cadence: 'QUARTERLY', recurringAmount: 300 },
        ]),
      },
      commission: { findMany: jest.fn().mockResolvedValueOnce([{ amount: 40 }, { amount: 60 }]) },
      invoice: {
        findMany: jest.fn().mockResolvedValueOnce([
          { id: 'inv-1', status: 'unpaid', totalAmount: 200 },
          { id: 'inv-2', status: 'paid', totalAmount: 150 },
        ]),
      },
    };

    const uc = new GetFinancialReportUseCase(prisma);
    const report = await uc.execute('t-1');
    expect(report.mrr).toBe(200);
    expect(report.arr).toBe(2400);
    expect(report.totalCommissions).toBe(100);
    expect(report.outstandingInvoices).toHaveLength(1);
  });

  it('RecordPaymentUseCase applies payment to invoice and saves payment', async () => {
    const fakeInvoice: any = {
      id: 'inv-1',
      status: 'unpaid',
      remainingBalance: Money.fromDollars(200),
      applyPayment(m: Money) {
        this.remainingBalance = Money.fromDollars(this.remainingBalance.toDollars() - m.toDollars());
        this.status = 'paid';
      },
    };
    const invoiceRepo: any = {
      findById: jest.fn().mockResolvedValueOnce(fakeInvoice).mockResolvedValueOnce(null),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const paymentRepo: any = { save: jest.fn().mockResolvedValue(undefined) };

    const uc = new RecordPaymentUseCase(invoiceRepo, paymentRepo);
    const res = await uc.execute({
      tenantId: 't-1',
      customerId: 'c-1',
      amount: 200,
      method: 'credit_card',
      invoiceId: 'inv-1',
    });
    expect(res.amount).toBe(200);
    expect(res.invoice?.status).toBe('paid');
    expect(paymentRepo.save).toHaveBeenCalledTimes(1);

    await expect(
      uc.execute({ tenantId: 't-1', customerId: 'c-1', amount: 50, method: 'cash', invoiceId: 'missing' })
    ).rejects.toThrow('Invoice missing not found');
  });

  it('CRM Use Cases: GetCustomerList, GetCustomerProfile, UpdateCustomerPreferences, CalculateCustomerHealthScore', async () => {
    const customer = makeCustomer();
    const customerRepo: any = {
      findAll: jest.fn().mockResolvedValueOnce([customer]),
      findById: jest.fn().mockResolvedValue(customer),
      save: jest.fn().mockResolvedValue(undefined),
    };

    const list = await new GetCustomerListUseCase(customerRepo).execute('t-1');
    expect(list).toHaveLength(1);
    expect(list[0].email).toBe('alice@example.com');
    expect(list[0].propertyCount).toBe(1);

    const profile = await new GetCustomerProfileUseCase(customerRepo).execute('c-1', 't-1');
    expect(profile?.name).toBe('Alice Customer');
    expect(profile?.properties[0].city).toBe('Austin');

    const prefsRes = await new UpdateCustomerPreferencesUseCase(customerRepo).execute('c-1', 't-1', {
      smsEnabled: false,
      quietHoursStart: '21:00',
    });
    expect(prefsRes.preferences.smsEnabled).toBe(false);
    expect(prefsRes.preferences.quietHoursStart).toBe('21:00');

    const healthRes = await new CalculateCustomerHealthScoreUseCase(customerRepo).execute({
      customerId: 'c-1',
      tenantId: 't-1',
      unpaidInvoicesCount: 0,
      hasActiveContract: true,
      hasRecentContact: true,
      monthsSinceLastJob: 1,
    });
    expect(healthRes.customerId).toBe('c-1');
    expect(healthRes.score).toBeGreaterThanOrEqual(80);
  });

  it('Sales Use Cases: GenerateAgreement, SignAgreement, and GetTerritories', async () => {
    const agreementRepo: any = {
      save: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn(),
    };
    const generated = await new GenerateAgreementUseCase(agreementRepo).execute({
      tenantId: 't-1',
      customerId: 'c-1',
      propertyId: 'p-1',
      cadence: 'MONTHLY',
      recurringAmount: 149,
      startDate: '2026-12-01',
    });
    expect(generated.status).toBe('draft');
    expect(agreementRepo.save).toHaveBeenCalledTimes(1);

    agreementRepo.findById.mockResolvedValueOnce(generated);
    const prisma: any = {
      serviceContract: { create: jest.fn().mockResolvedValueOnce({ id: 'sc-1' }) },
      job: { create: jest.fn().mockResolvedValueOnce({ id: 'job-1' }) },
      territory: {
        findMany: jest.fn().mockResolvedValueOnce([
          {
            id: 'terr-1',
            name: 'North Zone',
            assignedRep: { id: 'u-1', email: 'rep@example.com', role: 'SALES' },
            canvassPins: [
              { id: '1', status: 'PITCHED', isDoNotKnock: false },
              { id: '2', status: 'SOLD', isDoNotKnock: false },
              { id: '3', status: 'NOT_HOME', isDoNotKnock: true },
            ],
            doNotKnockRecords: [{ id: 'dnk-1' }],
          },
        ]),
      },
    };

    const signed = await new SignAgreementUseCase(agreementRepo, prisma).execute({
      agreementId: generated.id,
      signatureSvg: '<svg>sig</svg>',
      signerName: 'Alice',
    });
    expect(signed.contractId).toBe('sc-1');
    expect(prisma.job.create).toHaveBeenCalledTimes(1);

    const territories = await new GetTerritoriesUseCase({} as any, prisma).execute('t-1');
    expect(territories).toHaveLength(1);
    expect(territories[0].stats.totalPins).toBe(3);
  });
});
