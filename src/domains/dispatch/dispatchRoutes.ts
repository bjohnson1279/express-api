import { FastifyPluginAsync } from 'fastify';
import { optimizeRoute, emergencyDispatch, autoSchedule, commitSchedule } from './dispatchController';

const routes: FastifyPluginAsync = async (fastify, opts) => {
fastify.post('/optimize', optimizeRoute);
fastify.post('/emergency', emergencyDispatch);
fastify.post('/auto-schedule', autoSchedule);
fastify.post('/commit-schedule', commitSchedule);

};

export default routes;
