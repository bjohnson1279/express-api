import request from 'supertest';
import express from 'express';
import inventoryRoutes from '../src/routes/inventoryRoutes';

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mPrismaClient = {
    inventoryItem: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'item-1', name: 'Air Filter', sku: 'AF-001', quantity: 5, minimumThreshold: 10 }
      ]),
      create: jest.fn().mockResolvedValue({
        id: 'item-2', name: 'Spark Plug', sku: 'SP-002', quantity: 20, minimumThreshold: 15
      }),
      update: jest.fn().mockResolvedValue({
        id: 'item-1', name: 'Air Filter', quantity: 15
      })
    },
    purchaseOrder: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'po-1', itemId: 'item-1', quantity: 20, status: 'draft' }
      ]),
      create: jest.fn().mockResolvedValue({
        id: 'po-2', itemId: 'item-1', quantity: 20, status: 'draft'
      })
    }
  };
  return { PrismaClient: jest.fn(() => mPrismaClient) };
});

const app = express();
app.use(express.json());

// Mock auth middleware
app.use((req: any, res, next) => {
  req.user = { id: 'admin', role: 'SUPER_ADMIN', tenantId: 'mock-tenant-id' };
  next();
});
app.use('/api/v1/inventory', inventoryRoutes);

describe('Inventory API Controller', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Inventory Items', () => {
    it('GET /api/v1/inventory/items - should fetch items', async () => {
      const res = await request(app).get('/api/v1/inventory/items');
      expect(res.statusCode).toEqual(200);
      expect(res.body[0].name).toBe('Air Filter');
    });

    it('POST /api/v1/inventory/items - should create an item', async () => {
      const payload = { name: 'Spark Plug', sku: 'SP-002', quantity: 20, minimumThreshold: 15 };
      const res = await request(app).post('/api/v1/inventory/items').send(payload);
      expect(res.statusCode).toEqual(201);
      expect(res.body.name).toBe('Spark Plug');
    });

    it('PATCH /api/v1/inventory/items/:id/quantity - should update quantity', async () => {
      const res = await request(app).patch('/api/v1/inventory/items/item-1/quantity').send({ quantityDelta: 10 });
      expect(res.statusCode).toEqual(200);
      expect(res.body.quantity).toBe(15);
    });
  });

  describe('Purchase Orders', () => {
    it('GET /api/v1/inventory/purchase-orders - should fetch POs', async () => {
      const res = await request(app).get('/api/v1/inventory/purchase-orders');
      expect(res.statusCode).toEqual(200);
      expect(res.body[0].status).toBe('draft');
    });

    it('POST /api/v1/inventory/purchase-orders - should create PO', async () => {
      const payload = { itemId: 'item-1', quantity: 20 };
      const res = await request(app).post('/api/v1/inventory/purchase-orders').send(payload);
      expect(res.statusCode).toEqual(201);
      expect(res.body.status).toBe('draft');
    });
  });
});
