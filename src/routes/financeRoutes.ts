import { Router } from 'express';
import { getFinancialReport } from '../controllers/financeController';

const router = Router();
router.get('/report', getFinancialReport);
export default router;
