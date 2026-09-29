import twilio from 'twilio';
import nodemailer, { Transporter } from 'nodemailer';

export class NotificationService {
  private twilioClient: twilio.Twilio;
  private transporter: Transporter;

  constructor() {
    this.twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID || 'AC_mock',
      process.env.TWILIO_AUTH_TOKEN || 'mock_token'
    );

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: Number(process.env.SMTP_PORT) || 1025,
      secure: false,
      auth: {
        user: process.env.SMTP_USER || 'user',
        pass: process.env.SMTP_PASS || 'pass',
      },
    });
  }

  async sendSMS(to: string, body: string) {
    try {
      const message = await this.twilioClient.messages.create({
        body,
        from: process.env.TWILIO_PHONE_NUMBER || '+1234567890',
        to,
      });
      return { success: true, messageId: message.sid };
    } catch (error) {
      console.error('Failed to send SMS:', error);
      throw error;
    }
  }

  async sendRobocall(to: string, message: string) {
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
    } catch (error) {
      console.error('Failed to send Robocall:', error);
      throw error;
    }
  }

  async sendEmail(to: string, subject: string, text: string, html?: string) {
    try {
      const info = await this.transporter.sendMail({
        from: `"Servicing CRM" <${process.env.SMTP_FROM || 'noreply@crm.local'}>`,
        to,
        subject,
        text,
        html,
      });
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Failed to send Email:', error);
      throw error;
    }
  }
}
