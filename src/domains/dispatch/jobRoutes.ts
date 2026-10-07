import { Router } from 'express';
import { getJobs, getJobsCalendar, updateJob, createJob, clockIn, clockOut } from './jobController';

const router = Router();

router.get('/calendar', getJobsCalendar);
router.get('/', getJobs);
router.post('/', createJob);
router.patch('/:id', updateJob);
router.post('/:id/clock-in', clockIn);
router.post('/:id/clock-out', clockOut);

export default router;
