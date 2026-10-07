import { FastifyPluginAsync } from 'fastify';
import { getCanvassPins } from './canvassController';

const routes: FastifyPluginAsync = async (fastify, opts) => {
fastify.get('/pins', getCanvassPins);
};

export default routes;
