"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const twilio_1 = __importDefault(require("twilio"));
const nodemailer_1 = __importDefault(require("nodemailer"));
class NotificationService {
    twilioClient;
    transporter;
    constructor() {
        this.twilioClient = (0, twilio_1.default)(process.env.TWILIO_ACCOUNT_SID || 'AC_mock', process.env.TWILIO_AUTH_TOKEN || 'mock_token');
        this.transporter = nodemailer_1.default.createTransport({
            host: process.env.SMTP_HOST || 'localhost',
            port: Number(process.env.SMTP_PORT) || 1025,
            secure: false,
            auth: {
                user: process.env.SMTP_USER || 'user',
                pass: process.env.SMTP_PASS || 'pass',
            },
        });
    }
    async sendSMS(to, body) {
        try {
            const message = await this.twilioClient.messages.create({
                body,
                from: process.env.TWILIO_PHONE_NUMBER || '+1234567890',
                to,
            });
            return { success: true, messageId: message.sid };
        }
        catch (error) {
            console.error('Failed to send SMS:', error);
            throw error;
        }
    }
    async sendRobocall(to, message) {
        try {
            // Build TwiML for the IVR
            // <Gather> allows the user to press '1' to connect to Customer Service
            const twiml = `
        <Response>
          <Gather numDigits="1" action="/api/webhooks/twilio/voice-gather">
            <Say>${message}. Press 1 to connect to customer service.</Say>
          </Gather>
          <Say>We didn't receive any input. Goodbye!</Say>
        </Response>
      `;
            const call = await this.twilioClient.calls.create({
                twiml,
                to,
                from: process.env.TWILIO_PHONE_NUMBER || '+1234567890',
            });
            return { success: true, callId: call.sid };
        }
        catch (error) {
            console.error('Failed to send Robocall:', error);
            throw error;
        }
    }
    async sendEmail(to, subject, text, html) {
        try {
            const info = await this.transporter.sendMail({
                from: `"Servicing CRM" <${process.env.SMTP_FROM || 'noreply@crm.local'}>`,
                to,
                subject,
                text,
                html,
            });
            return { success: true, messageId: info.messageId };
        }
        catch (error) {
            console.error('Failed to send Email:', error);
            throw error;
        }
    }
}
exports.NotificationService = NotificationService;
