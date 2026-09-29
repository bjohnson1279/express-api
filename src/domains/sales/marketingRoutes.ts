import { Router } from 'express';
import { getCampaigns, createCampaign, scheduleFollowup } from './marketingController';

const router = Router();

router.get('/campaigns', getCampaigns);
router.post('/campaigns', createCampaign);
router.post('/followups', scheduleFollowup);

export default router;
