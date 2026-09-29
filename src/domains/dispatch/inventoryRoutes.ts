import { Router } from 'express';
import { 
  getInventoryItems, 
  createInventoryItem, 
  updateInventoryQuantity, 
  getPurchaseOrders, 
  createPurchaseOrder 
} from './inventoryController';

const router = Router();

router.get('/items', getInventoryItems);
router.post('/items', createInventoryItem);
router.patch('/items/:id/quantity', updateInventoryQuantity);

router.get('/purchase-orders', getPurchaseOrders);
router.post('/purchase-orders', createPurchaseOrder);

export default router;
