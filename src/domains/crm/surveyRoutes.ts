import { FastifyPluginAsync } from 'fastify';
import { createSurvey, submitResponse, getSurvey, listSurveys, npsDashboard } from './surveyController';

const routes: FastifyPluginAsync = async (fastify, opts) => {

fastify.get('/nps-dashboard', npsDashboard);
fastify.get('/', listSurveys);
fastify.get('/:id', getSurvey);
fastify.post('/', createSurvey);
fastify.post('/:id/respond', submitResponse);

};

export default routes;
