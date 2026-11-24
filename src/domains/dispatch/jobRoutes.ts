import { FastifyPluginAsync } from 'fastify';
import { getJobs, getJobsCalendar, updateJob, createJob, clockIn, clockOut, recordSignature, getSignature } from './jobController';

const routes: FastifyPluginAsync = async (fastify, opts) => {

fastify.get('/calendar', getJobsCalendar);
fastify.get('/', getJobs);
fastify.post('/', createJob);
fastify.patch('/:id', updateJob);
fastify.post('/:id/clock-in', clockIn);
fastify.post('/:id/clock-out', clockOut);
fastify.post('/:id/signature', recordSignature);
fastify.get('/:id/signature', getSignature);

};

export default routes;
