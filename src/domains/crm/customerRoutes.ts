import { FastifyPluginAsync } from 'fastify';
import { getCustomers, getCustomer, getPreferences, updatePreferences } from './customerController';

const routes: FastifyPluginAsync = async (fastify, opts) => {
fastify.get('/', getCustomers);
fastify.get('/:id', getCustomer);
fastify.get('/:id/preferences', getPreferences);
fastify.put('/:id/preferences', updatePreferences);
};

export default routes;
