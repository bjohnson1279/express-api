import { FastifyPluginAsync } from 'fastify';
import { getCampaigns, createCampaign, scheduleFollowup } from './marketingController';

const routes: FastifyPluginAsync = async (fastify, opts) => {

fastify.get('/campaigns', getCampaigns);
fastify.post('/campaigns', createCampaign);
fastify.post('/followups', scheduleFollowup);

};

export default routes;
