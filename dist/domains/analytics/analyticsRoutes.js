"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const analyticsController_1 = require("./analyticsController");
const routes = async (fastify, opts) => {
    fastify.get('/dashboard', analyticsController_1.getDashboardAnalytics);
    fastify.get('/labor-costs', analyticsController_1.getLaborCosts);
    fastify.get('/reports/export', analyticsController_1.exportReport);
    // AI Pest Risk Scoring & Heatmap
    fastify.get('/pest-risk/climate', analyticsController_1.getClimateMetrics);
    fastify.get('/pest-risk/heatmap', analyticsController_1.getPestRiskHeatmap);
    fastify.get('/pest-risk/:propertyId', analyticsController_1.getPropertyPestRisk);
    fastify.post('/pest-risk/recalculate', analyticsController_1.recalculatePestRisks);
};
exports.default = routes;
