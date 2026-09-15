import { Router } from 'express';
import { getStaff, getCourses, assignCertification } from '../controllers/hrController';

const router = Router();
router.get('/staff', getStaff);
router.get('/courses', getCourses);
router.post('/certifications', assignCertification);
export default router;
