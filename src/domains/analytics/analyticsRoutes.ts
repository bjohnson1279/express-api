import { Router } from 'express';
import { 
  getDashboardAnalytics, 
  getPropertyPestRisk, 
  getPestRiskHeatmap, 
  recalculatePestRisks 
} from './analyticsController';

const router = Router();

router.get('/dashboard', getDashboardAnalytics);

// AI Pest Risk Scoring & Heatmap
router.get('/pest-risk/heatmap', getPestRiskHeatmap);
router.get('/pest-risk/:propertyId', getPropertyPestRisk);
router.post('/pest-risk/recalculate', recalculatePestRisks);

export default router;
