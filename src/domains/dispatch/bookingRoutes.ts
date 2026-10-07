import { FastifyPluginAsync } from 'fastify';
import { getAvailableSlots, createBooking } from './bookingController';

const routes: FastifyPluginAsync = async (fastify, opts) => {

fastify.get('/slots', getAvailableSlots);
fastify.post('/', createBooking);

};

export default routes;
