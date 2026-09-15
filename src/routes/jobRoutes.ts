import { Router } from 'express';
import { getJobs, updateJob, createJob } from '../controllers/jobController';

const router = Router();

router.get('/', getJobs);
router.post('/', createJob);
router.patch('/:id', updateJob);

export default router;
