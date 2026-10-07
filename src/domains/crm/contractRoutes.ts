import { FastifyPluginAsync } from 'fastify';
import { getContracts } from './contractController';

const routes: FastifyPluginAsync = async (fastify, opts) => {

fastify.get('/', getContracts);

};

export default routes;
