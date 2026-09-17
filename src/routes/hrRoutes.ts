import { Router } from 'express';
import { getStaff, getCourses, assignCertification } from '../controllers/hrController';

import { OnboardingController, upload } from '../controllers/OnboardingController';

const router = Router();
router.get('/staff', getStaff);
router.get('/courses', getCourses);
router.post('/certifications', assignCertification);

// Onboarding Endpoints
router.get('/onboarding/:userId/tasks', OnboardingController.getTasks);
router.post('/onboarding/upload', upload.single('document'), OnboardingController.uploadDocument);

export default router;
