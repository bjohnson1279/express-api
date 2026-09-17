import { Router } from 'express';
import { getTechnicians, getTechnicianSchedule, updateLocation } from '../controllers/technicianController';

const router = Router();
router.get('/', getTechnicians);
router.get('/:id/schedule', getTechnicianSchedule);
router.patch('/:id/location', updateLocation);

export default router;
