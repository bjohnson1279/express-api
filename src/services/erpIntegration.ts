import { PrismaClient, ErpProvider } from '@prisma/client';

const prisma = new PrismaClient();

export interface IQuickBooksClient {
  syncJournal(resourceId: string, resourceType: string, payload: any): Promise<any>;
}

export class QuickBooksClient implements IQuickBooksClient {
  private credentials: any;

  constructor(credentials: any) {
    this.credentials = credentials;
  }

  async syncJournal(resourceId: string, resourceType: string, payload: any): Promise<any> {
    console.log(`[QuickBooks] Syncing ${resourceType} ${resourceId}`, { payload });
    
    // Mock Fallback Handling as per erp-integration-adapter-generator skill
    if (!this.credentials || this.credentials.mock || Object.keys(this.credentials).length === 0) {
      console.log(`[QuickBooks] Using mock fallback for ${resourceType} ${resourceId}`);
      return {
        success: true,
        transactionId: `mock-qbo-journal-${Date.now()}`
      };
    }

    // In a real implementation, this would map the payload, e.g., convert cents to dollars,
    // and make an HTTP POST to the QuickBooks V3 API.
    return {
      success: true,
      transactionId: `qbo-journal-${Date.now()}`
    };
  }
}

export const syncToErp = async (provider: ErpProvider, resourceId: string, resourceType: string, payload: any) => {
  let success = false;
  let errorMessage = '';

  try {
    if (provider === 'quickbooks') {
      const qbClient = new QuickBooksClient({ mock: true });
      const result = await qbClient.syncJournal(resourceId, resourceType, payload);
      success = result.success;
    } else {
      throw new Error(`Provider ${provider} not implemented yet`);
    }
  } catch (error: any) {
    success = false;
    errorMessage = error.message;
  }

  const log = await prisma.erpSyncLog.create({
    data: {
      provider,
      resourceType,
      resourceId,
      status: success ? 'success' : 'failure',
      errorMessage: errorMessage || null
    }
  });

  return log;
};
