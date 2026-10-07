"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwilioWebhookController = void 0;
const client_1 = require("@prisma/client");
const twilio_1 = __importDefault(require("twilio"));
const eventBus_1 = require("../comms/eventBus");
const prisma = new client_1.PrismaClient();
class TwilioWebhookController {
    static async handleInboundSms(req, reply) {
        const { From, Body, To } = req.body; // Twilio sends form-urlencoded data
        try {
            // Find customer by phone number
            const customerPhone = await prisma.customerPhone.findFirst({
                where: { phoneNumber: From },
                include: {
                    customer: {
                        include: { user: true }
                    }
                }
            });
            if (customerPhone && customerPhone.customer.user) {
                // Log the inbound SMS to contact_logs
                await prisma.contactLog.create({
                    data: {
                        tenantId: customerPhone.customer.user.tenantId,
                        customerId: customerPhone.customerId,
                        channel: 'SMS',
                        direction: 'INBOUND',
                        summary: `Received SMS: ${Body}`
                    }
                });
            }
            // Respond with empty TwiML
            const twiml = new twilio_1.default.twiml.MessagingResponse();
            eventBus_1.eventBus.broadcast('sms_received', { From, Body, To });
            reply.type('text/xml').send(twiml.toString());
        }
        catch (error) {
            console.error('Error handling inbound SMS:', error);
            reply.status(500).send('Internal Server Error');
        }
    }
    static async handleVoiceGather(req, reply) {
        const { Digits } = req.body;
        const twiml = new twilio_1.default.twiml.VoiceResponse();
        if (Digits === '1') {
            twiml.say('Connecting you to customer service.');
            twiml.dial(process.env.CUSTOMER_SERVICE_NUMBER || '+18005550199');
        }
        else {
            twiml.say('Invalid input. Goodbye.');
        }
        reply.type('text/xml').send(twiml.toString());
    }
}
exports.TwilioWebhookController = TwilioWebhookController;
