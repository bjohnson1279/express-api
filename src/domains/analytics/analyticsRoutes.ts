import { Router } from 'express';
import { getDashboardAnalytics } from './analyticsController';

const router = Router();

router.get('/dashboard', getDashboardAnalytics);

export default router;
