import { Router } from 'express';
import { getAvailableSlots, createBooking } from './bookingController';

const router = Router();

router.get('/slots', getAvailableSlots);
router.post('/', createBooking);

export default router;
