import { Router } from 'express';
import { optimizeRoute, emergencyDispatch, autoSchedule, commitSchedule } from '../controllers/dispatchController';

const router = Router();
router.post('/optimize', optimizeRoute);
router.post('/emergency', emergencyDispatch);
router.post('/auto-schedule', autoSchedule);
router.post('/commit-schedule', commitSchedule);

export default router;
