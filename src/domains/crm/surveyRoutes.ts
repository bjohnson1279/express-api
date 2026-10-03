import { Router } from 'express';
import { createSurvey, submitResponse, getSurvey, listSurveys, npsDashboard } from './surveyController';

const router = Router();

router.get('/nps-dashboard', npsDashboard);
router.get('/', listSurveys);
router.get('/:id', getSurvey);
router.post('/', createSurvey);
router.post('/:id/respond', submitResponse);

export default router;
