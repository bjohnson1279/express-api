"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TwilioWebhookController_1 = require("./TwilioWebhookController");
const routes = async (fastify, opts) => {
    // Twilio webhooks are form-urlencoded
    fastify.use(express.urlencoded({ extended: true }));
    fastify.post('/sms', TwilioWebhookController_1.TwilioWebhookController.handleInboundSms);
    fastify.post('/voice-gather', TwilioWebhookController_1.TwilioWebhookController.handleVoiceGather);
};
exports.default = routes;
