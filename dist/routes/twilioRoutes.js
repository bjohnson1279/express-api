"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const TwilioWebhookController_1 = require("../controllers/TwilioWebhookController");
const express_2 = __importDefault(require("express"));
const router = (0, express_1.Router)();
// Twilio webhooks are form-urlencoded
router.use(express_2.default.urlencoded({ extended: true }));
router.post('/sms', TwilioWebhookController_1.TwilioWebhookController.handleInboundSms);
router.post('/voice-gather', TwilioWebhookController_1.TwilioWebhookController.handleVoiceGather);
exports.default = router;
