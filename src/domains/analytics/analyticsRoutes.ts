import { Router } from 'express';
import { 
  getDashboardAnalytics, 
  getPropertyPestRisk, 
  getPestRiskHeatmap, 
  recalculatePestRisks,
  getClimateMetrics,
  getLaborCosts,
  exportReport
} from './analyticsController';

const router = Router();

router.get('/dashboard', getDashboardAnalytics);
router.get('/labor-costs', getLaborCosts);
router.get('/reports/export', exportReport);

// AI Pest Risk Scoring & Heatmap
router.get('/pest-risk/climate', getClimateMetrics);
router.get('/pest-risk/heatmap', getPestRiskHeatmap);
router.get('/pest-risk/:propertyId', getPropertyPestRisk);
router.post('/pest-risk/recalculate', recalculatePestRisks);

export default router;
