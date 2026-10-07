import { FastifyPluginAsync } from 'fastify';
import { 
  getDashboardAnalytics, 
  getPropertyPestRisk, 
  getPestRiskHeatmap, 
  recalculatePestRisks,
  getClimateMetrics,
  getLaborCosts,
  exportReport
} from './analyticsController';

const routes: FastifyPluginAsync = async (fastify, opts) => {

fastify.get('/dashboard', getDashboardAnalytics);
fastify.get('/labor-costs', getLaborCosts);
fastify.get('/reports/export', exportReport);

// AI Pest Risk Scoring & Heatmap
fastify.get('/pest-risk/climate', getClimateMetrics);
fastify.get('/pest-risk/heatmap', getPestRiskHeatmap);
fastify.get('/pest-risk/:propertyId', getPropertyPestRisk);
fastify.post('/pest-risk/recalculate', recalculatePestRisks);

};

export default routes;
