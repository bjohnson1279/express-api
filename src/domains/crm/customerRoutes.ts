import { Router } from 'express';
import { getCustomers, getCustomer } from './customerController';

const router = Router();
router.get('/', getCustomers);
router.get('/:id', getCustomer);
export default router;
