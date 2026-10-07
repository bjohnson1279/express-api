import { FastifyPluginAsync } from 'fastify';
import { TwilioWebhookController } from './TwilioWebhookController';
import formbody from '@fastify/formbody';

const routes: FastifyPluginAsync = async (fastify, opts) => {

// Twilio webhooks are form-urlencoded
fastify.register(formbody);

fastify.post('/sms', TwilioWebhookController.handleInboundSms);
fastify.post('/voice-gather', TwilioWebhookController.handleVoiceGather);

};

export default routes;
