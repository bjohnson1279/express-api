"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const surveyController_1 = require("./surveyController");
const routes = async (fastify, opts) => {
    fastify.get('/nps-dashboard', surveyController_1.npsDashboard);
    fastify.get('/', surveyController_1.listSurveys);
    fastify.get('/:id', surveyController_1.getSurvey);
    fastify.post('/', surveyController_1.createSurvey);
    fastify.post('/:id/respond', surveyController_1.submitResponse);
};
exports.default = routes;
