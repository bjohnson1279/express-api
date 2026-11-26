const mockPrisma: any = {
  $queryRaw: jest.fn(),
  user: { findMany: jest.fn(), findFirst: jest.fn() },
  trainingCourse: { findMany: jest.fn(), findFirst: jest.fn() },
  employeeCertification: { create: jest.fn() },
};

jest.mock('../src/shared/database', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

jest.mock('../src/domains/crm/callbackService', () => {
  const actual = jest.requireActual('../src/domains/crm/callbackService');
  return {
    ...actual,
    callbackActor: jest.fn(() => ({ id: 'u1', tenantId: 't1', role: 'ADMIN' })),
    callbackCommand: jest.fn(),
  };
});

import callbackRoutes from '../src/domains/crm/callbackRoutes';
import { callbackCommand } from '../src/domains/crm/callbackService';
import { inspectionCommand } from '../src/domains/crm/inspectionService';
import { playbookCommand } from '../src/domains/crm/playbookService';
import { getStaff, getCourses, assignCertification } from '../src/domains/hr/hrController';
import { Address } from '../src/domain/crm/valueObjects/Address';
import { SalesCampaign } from '../src/domain/sales/entities/SalesCampaign';
import { ServiceAgreement } from '../src/domain/sales/entities/ServiceAgreement';
import { Money } from '../src/domain/billing/valueObjects/Money';

function mockReply() {
  const listeners: Record<string, Function[]> = {};
  const raw: any = {
    writes: [] as string[],
    ended: false,
    writeHead: jest.fn(),
    write: jest.fn((chunk: string) => { raw.writes.push(chunk); }),
    end: jest.fn(() => { raw.ended = true; }),
    on: jest.fn((ev: string, fn: Function) => { (listeners[ev] ||= []).push(fn); }),
    emit: (ev: string) => { (listeners[ev] || []).forEach((fn) => fn()); },
  };
  const r: any = {
    statusCode: 200,
    body: undefined,
    raw,
    hijack: jest.fn(),
    code(c: number) { this.statusCode = c; return this; },
    status(c: number) { this.statusCode = c; return this; },
    send(b: any) { this.body = b; return this; },
  };
  return r;
}

describe('Express Wave 25: SSE callback stream, inspection/playbook services, HR errors, and domain entities', () => {
  beforeEach(() => jest.clearAllMocks());

  it('covers callbackRoutes /events SSE stream lifecycle', async () => {
    let eventsHandler: any = null;
    const fakeApp: any = {
      get: jest.fn((url: string, handler: any) => { if (url === '/events') eventsHandler = handler; }),
      route: jest.fn(),
    };
    await callbackRoutes(fakeApp, {} as any);
    expect(eventsHandler).toBeTruthy();

    let intervalFn: Function | null = null;
    const setIntSpy = jest.spyOn(global, 'setInterval').mockImplementation(((fn: Function) => {
      intervalFn = fn;
      return 456 as any;
    }) as any);
    const clearIntSpy = jest.spyOn(global, 'clearInterval').mockImplementation((() => {}) as any);

    (callbackCommand as jest.Mock)
      .mockResolvedValueOnce([{ id: 'cb-1' }])
      .mockResolvedValueOnce([{ id: 'cb-1' }, { id: 'cb-2' }])
      .mockResolvedValueOnce([{ id: 'cb-1' }, { id: 'cb-2' }])
      .mockRejectedValueOnce(new Error('stream err'));

    const reply = mockReply();
    await eventsHandler({ headers: { authorization: 'Bearer tok' } }, reply);
    expect(reply.hijack).toHaveBeenCalled();
    expect(reply.raw.writes[0]).toContain('event: callbacks');

    await intervalFn!();
    expect(reply.raw.writes[1]).toContain('cb-2');

    await intervalFn!();
    expect(reply.raw.writes[2]).toBe(': keepalive\n\n');

    await intervalFn!();
    expect(clearIntSpy).toHaveBeenCalledWith(456);
    expect(reply.raw.ended).toBe(true);

    reply.raw.emit('close');
    expect(clearIntSpy).toHaveBeenCalledTimes(2);

    (callbackCommand as jest.Mock).mockRejectedValueOnce(new Error('init fail'));
    const errReply = mockReply();
    await eventsHandler({ headers: {} }, errReply);
    expect(errReply.statusCode).toBe(500);

    setIntSpy.mockRestore();
    clearIntSpy.mockRestore();
  });

  it('covers inspectionCommand and playbookCommand success and PG error mapping', async () => {
    const actor = { id: 'u1', tenantId: 't1', role: 'ADMIN' };
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ result: { ok: true } }]);
    expect(await inspectionCommand(actor, 'list')).toEqual({ ok: true });

    mockPrisma.$queryRaw.mockRejectedValueOnce({ meta: { code: 'P0404', message: 'ERROR: Not found' } });
    await expect(inspectionCommand(actor, 'get')).rejects.toMatchObject({ status: 404, message: 'Not found' });

    mockPrisma.$queryRaw.mockRejectedValueOnce({ meta: { code: '22P02' } });
    await expect(inspectionCommand(actor, 'get')).rejects.toMatchObject({ status: 400 });

    mockPrisma.$queryRaw.mockRejectedValueOnce({ meta: { code: '23505', message: 'dup' } });
    await expect(inspectionCommand(actor, 'create')).rejects.toMatchObject({ status: 409 });

    mockPrisma.$queryRaw.mockRejectedValueOnce(new Error('boom'));
    await expect(inspectionCommand(actor, 'create')).rejects.toMatchObject({ status: 500 });

    mockPrisma.$queryRaw.mockResolvedValueOnce([{ result: { ok: 'pb' } }]);
    expect(await playbookCommand(actor, 'list')).toEqual({ ok: 'pb' });

    mockPrisma.$queryRaw.mockRejectedValueOnce({ meta: { code: 'P0403', message: 'ERROR: Forbidden' } });
    await expect(playbookCommand(actor, 'get')).rejects.toMatchObject({ status: 403, message: 'Forbidden' });

    mockPrisma.$queryRaw.mockRejectedValueOnce({ meta: { code: '23505' } });
    await expect(playbookCommand(actor, 'create')).rejects.toMatchObject({ status: 409 });

    mockPrisma.$queryRaw.mockRejectedValueOnce(new Error('boom'));
    await expect(playbookCommand(actor, 'create')).rejects.toMatchObject({ status: 500 });
  });

  it('covers hrController error branches and domain value objects/entities', async () => {
    mockPrisma.user.findMany.mockRejectedValueOnce(new Error('db'));
    const r1 = mockReply(); await getStaff({ user: { tenantId: 't1' } } as any, r1); expect(r1.statusCode).toBe(500);

    mockPrisma.trainingCourse.findMany.mockRejectedValueOnce(new Error('db'));
    const r2 = mockReply(); await getCourses({ user: { tenantId: 't1' } } as any, r2); expect(r2.statusCode).toBe(500);

    mockPrisma.user.findFirst.mockRejectedValueOnce(new Error('db'));
    const r3 = mockReply(); await assignCertification({ user: { tenantId: 't1' }, body: { userId: 'u1', courseId: 'c1' } } as any, r3); expect(r3.statusCode).toBe(500);

    expect(new Address('123 Oak', 'Austin', 'TX').fullAddress).toBe('123 Oak, Austin, TX');
    expect(new Address('123 Oak', '', '', '78701').toString()).toBe('123 Oak, 78701');

    const camp = new SalesCampaign({
      id: 'sc-1',
      tenantId: 't1',
      name: 'Spring',
      budget: Money.fromDollars(1000),
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-05-01'),
    });
    expect(camp.name).toBe('Spring');
    expect(camp.budget?.amountInCents).toBe(100000);
    expect(camp.startDate).toBeInstanceOf(Date);
    expect(camp.endDate).toBeInstanceOf(Date);
    camp.updateBudget(null);
    expect(camp.budget).toBeNull();

    const agr = new ServiceAgreement({
      id: 'ag-1',
      tenantId: 't1',
      customerId: 'c1',
      propertyId: 'p1',
      cadence: 'monthly',
      recurringAmount: Money.fromDollars(120),
      startDate: new Date('2026-04-01'),
    });
    expect(() => agr.setPdfUrl('')).toThrow();
    agr.setPdfUrl('https://cdn.example/ag.pdf');
    expect(agr.pdfUrl).toBe('https://cdn.example/ag.pdf');
    agr.send();
    expect(() => agr.send()).toThrow();
    agr.cancel('customer request');
    expect(() => agr.cancel()).toThrow();
    agr.clearDomainEvents();
    expect(agr.domainEvents).toEqual([]);
  });
});
