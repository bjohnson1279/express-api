import { Router } from 'express';
import { getCustomers, getCustomer, getPreferences, updatePreferences } from './customerController';

const router = Router();
router.get('/', getCustomers);
router.get('/:id', getCustomer);
router.get('/:id/preferences', getPreferences);
router.put('/:id/preferences', updatePreferences);
export default router;
