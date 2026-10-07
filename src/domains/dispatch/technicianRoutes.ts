import { FastifyPluginAsync } from 'fastify';
import { getTechnicians, getTechnicianSchedule, updateLocation } from './technicianController';

const routes: FastifyPluginAsync = async (fastify, opts) => {
fastify.get('/', getTechnicians);
fastify.get('/:id/schedule', getTechnicianSchedule);
fastify.patch('/:id/location', updateLocation);

};

export default routes;
