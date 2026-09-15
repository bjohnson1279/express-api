import { Router } from 'express';
import { getTechnicians } from '../controllers/technicianController';

const router = Router();
router.get('/', getTechnicians);
export default router;
