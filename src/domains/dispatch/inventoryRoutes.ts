import { FastifyPluginAsync } from 'fastify';
import { 
  getInventoryItems, 
  createInventoryItem, 
  updateInventoryQuantity, 
  getPurchaseOrders, 
  createPurchaseOrder,
  recordChemicalApplication,
  getEpaComplianceReport
} from './inventoryController';

const routes: FastifyPluginAsync = async (fastify, opts) => {

fastify.get('/items', getInventoryItems);
fastify.post('/items', createInventoryItem);
fastify.patch('/items/:id/quantity', updateInventoryQuantity);

fastify.get('/orders', getPurchaseOrders);
fastify.get('/purchase-orders', getPurchaseOrders);
fastify.post('/orders', createPurchaseOrder);
fastify.post('/purchase-orders', createPurchaseOrder);

// Chemical logging & EPA Compliance
fastify.post('/chemical-logs', recordChemicalApplication);
fastify.get('/epa-report', getEpaComplianceReport);

};

export default routes;
