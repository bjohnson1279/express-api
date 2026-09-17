import { Router } from 'express';
import { getDashboardAnalytics } from '../controllers/analyticsController';

const router = Router();

router.get('/dashboard', getDashboardAnalytics);

export default router;
