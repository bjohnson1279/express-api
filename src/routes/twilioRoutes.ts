import { Router } from 'express';
import { TwilioWebhookController } from '../controllers/TwilioWebhookController';
import express from 'express';

const router = Router();

// Twilio webhooks are form-urlencoded
router.use(express.urlencoded({ extended: true }));

router.post('/sms', TwilioWebhookController.handleInboundSms);
router.post('/voice-gather', TwilioWebhookController.handleVoiceGather);

export default router;
