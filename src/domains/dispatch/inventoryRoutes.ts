import { Router } from 'express';
import { 
  getInventoryItems, 
  createInventoryItem, 
  updateInventoryQuantity, 
  getPurchaseOrders, 
  createPurchaseOrder,
  recordChemicalApplication,
  getEpaComplianceReport
} from './inventoryController';

const router = Router();

router.get('/items', getInventoryItems);
router.post('/items', createInventoryItem);
router.patch('/items/:id/quantity', updateInventoryQuantity);

router.get('/orders', getPurchaseOrders);
router.post('/orders', createPurchaseOrder);

// Chemical logging & EPA Compliance
router.post('/chemical-logs', recordChemicalApplication);
router.get('/epa-report', getEpaComplianceReport);

export default router;
