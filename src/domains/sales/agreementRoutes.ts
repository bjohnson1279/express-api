import { FastifyPluginAsync } from 'fastify';
import { generateAgreement, signAgreement, downloadAgreement } from './AgreementController';

const routes: FastifyPluginAsync = async (fastify, opts) => {

fastify.post('/', generateAgreement);
fastify.post('/:id/sign', signAgreement);
fastify.get('/:id/download', downloadAgreement);

};

export default routes;
