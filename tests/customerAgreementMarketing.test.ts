import fs from 'fs';

const mockPrisma: any = {
  customer: { findMany: jest.fn(), findFirst: jest.fn() },
  notificationPreference: { findUnique: jest.fn(), create: jest.fn() },
  campaign: { findMany: jest.fn(), create: jest.fn() },
  automatedFollowup: { create: jest.fn() },
};

jest.mock('../src/shared/database', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));

const mockRepoFindById = jest.fn();
jest.mock('../src/infrastructure/crm/PrismaCustomerRepository', () => ({
  PrismaCustomerRepository: jest.fn().mockImplementation(() => ({
    findById: (...args: any[]) => mockRepoFindById(...args),
  })),
}));

const mockUpdatePrefsExec = jest.fn();
jest.mock('../src/application/crm/UpdateCustomerPreferencesUseCase', () => ({
  UpdateCustomerPreferencesUseCase: jest.fn().mockImplementation(() => ({
    execute: (...args: any[]) => mockUpdatePrefsExec(...args),
  })),
}));

jest.mock('../src/application/crm/GetCustomerProfileUseCase', () => ({
  GetCustomerProfileUseCase: jest.fn().mockImplementation(() => ({ execute: jest.fn() })),
}));

const mockGenAgr = jest.fn();
const mockSignAgr = jest.fn();
jest.mock('../src/domains/sales/AgreementService', () => ({
  AgreementService: jest.fn().mockImplementation(() => ({
    generateAgreement: (...args: any[]) => mockGenAgr(...args),
    signAgreement: (...args: any[]) => mockSignAgr(...args),
  })),
}));

import {
  getCustomers,
  getCustomer,
  getPreferences,
  updatePreferences,
} from '../src/domains/crm/customerController';
import {
  generateAgreement,
  signAgreement,
  downloadAgreement,
} from '../src/domains/sales/AgreementController';
import {
  getCampaigns,
  createCampaign,
  scheduleFollowup,
} from '../src/domains/sales/marketingController';

function mockReply() {
  const r: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined,
    status(c: number) { this.statusCode = c; return this; },
    type(t: string) { this.headers['Content-Type'] = t; return this; },
    header(k: string, v: string) { this.headers[k] = v; return this; },
    send(b: any) { this.body = b; return this; },
  };
  return r;
}

describe('Express API: customerController, AgreementController, and marketingController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('customerController', () => {
    it('covers getCustomers, getCustomer, getPreferences, and updatePreferences', async () => {
      mockPrisma.customer.findMany.mockResolvedValueOnce([{ id: 'c1' }]);
      const r1 = mockReply();
      await getCustomers({ user: { tenantId: 't1' } } as any, r1);
      expect(r1.body).toEqual([{ id: 'c1' }]);

      mockPrisma.customer.findMany.mockRejectedValueOnce(new Error('db'));
      const r1e = mockReply();
      await getCustomers({ user: { tenantId: 't1' } } as any, r1e);
      expect(r1e.statusCode).toBe(500);

      mockPrisma.customer.findFirst.mockResolvedValueOnce(null);
      const r2 = mockReply();
      await getCustomer({ params: { id: 'c1' }, user: { tenantId: 't1' } } as any, r2);
      expect(r2.statusCode).toBe(404);

      mockPrisma.customer.findFirst.mockResolvedValueOnce({ id: 'c1', name: 'Alice' });
      const r3 = mockReply();
      await getCustomer({ params: { id: 'c1' }, user: { tenantId: 't1' } } as any, r3);
      expect(r3.body.name).toBe('Alice');

      mockRepoFindById.mockResolvedValueOnce(null);
      const r4 = mockReply();
      await getPreferences({ params: { id: 'c1' }, user: { tenantId: 't1' } } as any, r4);
      expect(r4.statusCode).toBe(404);

      mockRepoFindById.mockResolvedValueOnce({ id: 'c1' });
      mockPrisma.notificationPreference.findUnique.mockResolvedValueOnce(null);
      mockPrisma.notificationPreference.create.mockResolvedValueOnce({ customerId: 'c1', smsEnabled: true });
      const r5 = mockReply();
      await getPreferences({ params: { id: 'c1' }, user: { tenantId: 't1' } } as any, r5);
      expect(r5.body.smsEnabled).toBe(true);

      mockPrisma.customer.findFirst.mockResolvedValueOnce(null);
      const r6 = mockReply();
      await updatePreferences({ params: { id: 'c1' }, body: {}, user: { tenantId: 't1' } } as any, r6);
      expect(r6.statusCode).toBe(404);

      mockPrisma.customer.findFirst.mockResolvedValueOnce({ id: 'c1' });
      mockUpdatePrefsExec.mockResolvedValueOnce(undefined);
      mockPrisma.notificationPreference.findUnique.mockResolvedValueOnce({ customerId: 'c1', emailEnabled: false });
      const r7 = mockReply();
      await updatePreferences({ params: { id: 'c1' }, body: { emailEnabled: false }, user: { tenantId: 't1' } } as any, r7);
      expect(r7.body.emailEnabled).toBe(false);
    });
  });

  describe('AgreementController', () => {
    it('covers generateAgreement, signAgreement, and downloadAgreement', async () => {
      mockGenAgr.mockResolvedValueOnce({ id: 'a1' });
      const r1 = mockReply();
      await generateAgreement({ body: { tenantId: 't1', customerId: 'c1', propertyId: 'p1', cadence: 'MONTHLY', recurringAmount: 99, startDate: '2026-06-01' } } as any, r1);
      expect(r1.statusCode).toBe(201);

      mockGenAgr.mockRejectedValueOnce(new Error('fail'));
      const r1e = mockReply();
      await generateAgreement({ body: {} } as any, r1e);
      expect(r1e.statusCode).toBe(500);

      mockSignAgr.mockResolvedValueOnce({ id: 'a1', status: 'SIGNED' });
      const r2 = mockReply();
      await signAgreement({ params: { id: 'a1' }, body: { signatureSvg: '<svg/>' } } as any, r2);
      expect(r2.body.status).toBe('SIGNED');

      const rBad = mockReply();
      await downloadAgreement({ params: { id: 'bad-id' } } as any, rBad);
      expect(rBad.statusCode).toBe(400);

      const uuid = '11111111-1111-1111-1111-111111111111';
      jest.spyOn(fs, 'existsSync').mockReturnValueOnce(false);
      const r404 = mockReply();
      await downloadAgreement({ params: { id: uuid } } as any, r404);
      expect(r404.statusCode).toBe(404);

      jest.spyOn(fs, 'existsSync').mockReturnValueOnce(true);
      jest.spyOn(fs, 'createReadStream').mockReturnValueOnce('pdf-stream' as any);
      const r200 = mockReply();
      await downloadAgreement({ params: { id: uuid } } as any, r200);
      expect(r200.body).toBe('pdf-stream');
    });
  });

  describe('marketingController', () => {
    it('covers getCampaigns, createCampaign, and scheduleFollowup', async () => {
      mockPrisma.campaign.findMany.mockResolvedValueOnce([{ id: 'camp-1' }]);
      const r1 = mockReply();
      await getCampaigns({ user: { tenantId: 't1' } } as any, r1);
      expect(r1.body).toEqual([{ id: 'camp-1' }]);

      mockPrisma.campaign.create.mockResolvedValueOnce({ id: 'camp-2', name: 'Spring' });
      const r2 = mockReply();
      await createCampaign({ user: { tenantId: 't1' }, body: { name: 'Spring', startDate: '2026-04-01', endDate: '2026-06-01', budget: '500' } } as any, r2);
      expect(r2.statusCode).toBe(201);

      mockPrisma.automatedFollowup.create.mockResolvedValueOnce({ id: 'fu-1' });
      const r3 = mockReply();
      await scheduleFollowup({ user: { tenantId: 't1' }, body: { customerId: 'c1', campaignId: 'camp-2', sequenceType: 'EMAIL', scheduledDate: '2026-04-10' } } as any, r3);
      expect(r3.statusCode).toBe(201);

      mockPrisma.automatedFollowup.create.mockRejectedValueOnce(new Error('db'));
      const r3e = mockReply();
      await scheduleFollowup({ user: { tenantId: 't1' }, body: { scheduledDate: '2026-04-10' } } as any, r3e);
      expect(r3e.statusCode).toBe(500);
    });
  });
});
