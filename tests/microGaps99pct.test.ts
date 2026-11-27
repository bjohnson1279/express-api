import { scryptSync } from 'crypto';

const mockPrisma: any = {
  $queryRaw: jest.fn(),
  customer: { findFirst: jest.fn() },
  automatedFollowup: { findMany: jest.fn(), update: jest.fn() },
  customerEmail: { findFirst: jest.fn() },
  serviceContract: { findMany: jest.fn() },
  canvassPin: { findMany: jest.fn() },
  doNotKnockRecord: { findMany: jest.fn(), create: jest.fn(), delete: jest.fn() },
  chemicalApplicationLog: { create: jest.fn(), findMany: jest.fn() },
};

jest.mock('../src/shared/database', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

const mockSchedule = jest.fn();
jest.mock('../src/shared/scheduler', () => ({
  __esModule: true,
  default: { schedule: (...a: any[]) => mockSchedule(...a) },
}));

jest.mock('twilio', () => jest.fn(() => ({ messages: { create: jest.fn() }, calls: { create: jest.fn() } })));
jest.mock('nodemailer', () => ({
  __esModule: true,
  createTransport: jest.fn(() => ({ sendMail: jest.fn() })),
  default: { createTransport: jest.fn(() => ({ sendMail: jest.fn() })) },
}));

import { catalogCommand } from '../src/domains/crm/catalogService';
import { commercialCommand } from '../src/domains/crm/commercialService';
import { deviceCommand } from '../src/domains/crm/deviceService';
import { profitabilityCommand } from '../src/domains/crm/profitabilityService';
import { recurringCommand } from '../src/domains/crm/recurringService';
import { PrismaCustomerRepository } from '../src/infrastructure/crm/PrismaCustomerRepository';
import { startFollowUpCron } from '../src/domains/sales/FollowUpCron';
import { verifyPassword } from '../src/shared/auth/password';
import { Payment } from '../src/domain/billing/entities/Payment';
import { Money } from '../src/domain/billing/valueObjects/Money';
import { HealthScore } from '../src/domain/crm/valueObjects/HealthScore';
import { CalculateCustomerHealthScoreUseCase } from '../src/application/crm/CalculateCustomerHealthScoreUseCase';
import { UpdateCustomerPreferencesUseCase } from '../src/application/crm/UpdateCustomerPreferencesUseCase';
import { SignAgreementUseCase } from '../src/application/sales/SignAgreementUseCase';
import { getContracts } from '../src/domains/crm/contractController';
import { getCanvassPins } from '../src/domains/sales/canvassController';
import { getDoNotKnockList, createDoNotKnock, deleteDoNotKnock } from '../src/domains/sales/territoryController';
import { recordChemicalApplication, getEpaComplianceReport } from '../src/domains/dispatch/inventoryController';

function mockReply() {
  const r: any = {
    statusCode: 200,
    body: undefined,
    status(c: number) { this.statusCode = c; return this; },
    send(b: any) { this.body = b; return this; },
  };
  return r;
}

describe('Express Wave 27: 5 CRM command services, scrypt, repo fallback, crons, use cases, and controller catches', () => {
  beforeEach(() => jest.clearAllMocks());

  it('covers catalog, commercial, device, profitability, and recurring command services', async () => {
    const actor = { id: 'u1', tenantId: 't1', role: 'ADMIN' };
    const cmds = [catalogCommand, commercialCommand, deviceCommand, profitabilityCommand, recurringCommand];
    for (const cmd of cmds) {
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ result: { ok: true } }]);
      expect(await cmd(actor, 'list')).toEqual({ ok: true });

      mockPrisma.$queryRaw.mockRejectedValueOnce({ meta: { code: 'P0404', message: 'ERROR: Missing' } });
      await expect(cmd(actor, 'get')).rejects.toMatchObject({ status: 404, message: 'Missing' });

      mockPrisma.$queryRaw.mockRejectedValueOnce({ meta: { code: '22P02' } });
      await expect(cmd(actor, 'get')).rejects.toMatchObject({ status: 400 });

      mockPrisma.$queryRaw.mockRejectedValueOnce({ meta: { code: '23505' } });
      await expect(cmd(actor, 'create')).rejects.toMatchObject({ status: 409 });

      mockPrisma.$queryRaw.mockRejectedValueOnce(new Error('db'));
      await expect(cmd(actor, 'create')).rejects.toMatchObject({ status: 500 });
    }
  });

  it('covers PrismaCustomerRepository email fallback, FollowUpCron catches, and legacy scrypt verification', async () => {
    const repo = new PrismaCustomerRepository(mockPrisma);
    mockPrisma.customer.findFirst.mockResolvedValueOnce({
      id: 'c1',
      name: 'Alice',
      user: { tenantId: 't1', email: null },
      emails: [{ emailAddress: 'alt@example.com' }],
      phones: [],
      properties: [],
      notificationPreference: null,
      healthScores: [],
      createdAt: new Date(),
    });
    const cust = await repo.findById('c1', 't1');
    expect(cust?.email?.value).toBe('alt@example.com');

    startFollowUpCron();
    const cronFn = mockSchedule.mock.calls[0][1];
    mockPrisma.automatedFollowup.findMany.mockResolvedValueOnce([
      { id: 'fu-1', customerId: 'c1', customer: { name: 'Alice' }, campaign: { name: 'Spring' } },
    ]);
    mockPrisma.customerEmail.findFirst.mockRejectedValueOnce(new Error('email db err'));
    await cronFn();
    expect(mockPrisma.automatedFollowup.update).toHaveBeenCalledWith({
      where: { id: 'fu-1' },
      data: { sentStatus: 'failed' },
    });

    mockPrisma.automatedFollowup.findMany.mockRejectedValueOnce(new Error('outer db err'));
    await cronFn();

    const salt = '0123456789abcdef0123456789abcdef';
    const derived = scryptSync('MySecret!', salt, 64).toString('hex');
    expect(await verifyPassword('MySecret!', `scrypt:${salt}:${derived}`)).toBe(true);
    expect(await verifyPassword('WrongPass', `scrypt:${salt}:${derived}`)).toBe(false);
  });

  it('covers value-object/entity guards, use-case not-found errors, and remaining controller catches', async () => {
    expect(() => Money.fromDollars(NaN)).toThrow('integer');
    expect(() => new Payment('p1' as any, 't1' as any, 'c1' as any, Money.zero(), 'card' as any)).toThrow('greater than zero');
    expect(new HealthScore(80).equals(new HealthScore(80))).toBe(true);

    const calcUc = new CalculateCustomerHealthScoreUseCase({ findById: jest.fn().mockResolvedValue(null) } as any);
    await expect(calcUc.execute({ customerId: 'c1', tenantId: 't1' } as any)).rejects.toThrow();

    const prefUc = new UpdateCustomerPreferencesUseCase({ findById: jest.fn().mockResolvedValue(null) } as any);
    await expect(prefUc.execute('c1', 't1', {} as any)).rejects.toThrow();

    const signUc = new SignAgreementUseCase({ findById: jest.fn().mockResolvedValue(null) } as any, mockPrisma);
    await expect(signUc.execute({ agreementId: 'a1', tenantId: 't1', signatureSvg: '<svg/>' } as any)).rejects.toThrow();

    mockPrisma.serviceContract.findMany.mockRejectedValueOnce(new Error('db'));
    const r1 = mockReply(); await getContracts({ user: { tenantId: 't1' } } as any, r1); expect(r1.statusCode).toBe(500);

    mockPrisma.canvassPin.findMany.mockRejectedValueOnce(new Error('db'));
    const r2 = mockReply(); await getCanvassPins({} as any, r2); expect(r2.statusCode).toBe(500);

    mockPrisma.doNotKnockRecord.findMany.mockRejectedValueOnce(new Error('db'));
    const r3 = mockReply(); await getDoNotKnockList({ user: { tenantId: 't1' } } as any, r3); expect(r3.statusCode).toBe(500);

    mockPrisma.doNotKnockRecord.create.mockRejectedValueOnce(new Error('db'));
    const r4 = mockReply(); await createDoNotKnock({ user: { tenantId: 't1' }, body: { address: '1 Main' } } as any, r4); expect(r4.statusCode).toBe(500);

    mockPrisma.doNotKnockRecord.delete.mockRejectedValueOnce(new Error('db'));
    const r5 = mockReply(); await deleteDoNotKnock({ params: { id: 'd1' } } as any, r5); expect(r5.statusCode).toBe(500);

    mockPrisma.chemicalApplicationLog.create.mockRejectedValueOnce(new Error('db'));
    const r6 = mockReply();
    await recordChemicalApplication({ user: { tenantId: 't1' }, body: { jobId: 'j1', technicianId: 'tech1', chemicalName: 'Spray', quantityUsed: '2', unit: 'oz' } } as any, r6);
    expect(r6.statusCode).toBe(500);

    mockPrisma.chemicalApplicationLog.findMany.mockResolvedValueOnce([
      { chemicalName: 'Spray', epaRegistrationNo: 'EPA-1', quantityUsed: 2, unit: 'oz', targetPests: ['Ants', 'Spiders'] },
    ]);
    const r7 = mockReply();
    await getEpaComplianceReport({ query: { startDate: '2026-01-01', endDate: '2026-12-31' } } as any, r7);
    expect(r7.body.chemicalSummary[0].targetPests).toEqual(['Ants', 'Spiders']);

    mockPrisma.chemicalApplicationLog.findMany.mockRejectedValueOnce(new Error('db'));
    const r8 = mockReply();
    await getEpaComplianceReport({ query: {} } as any, r8);
    expect(r8.statusCode).toBe(500);
  });
});
