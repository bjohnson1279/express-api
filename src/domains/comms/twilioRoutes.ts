import { FastifyPluginAsync } from 'fastify';
import { TwilioWebhookController } from './TwilioWebhookController';


const routes: FastifyPluginAsync = async (fastify, opts) => {

// Twilio webhooks are form-urlencoded
fastify.use(express.urlencoded({ extended: true }));

fastify.post('/sms', TwilioWebhookController.handleInboundSms);
fastify.post('/voice-gather', TwilioWebhookController.handleVoiceGather);

};

export default routes;
