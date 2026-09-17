import { Router } from 'express';
import { optimizeRoute, emergencyDispatch } from '../controllers/dispatchController';

const router = Router();
router.post('/optimize', optimizeRoute);
router.post('/emergency', emergencyDispatch);

export default router;
