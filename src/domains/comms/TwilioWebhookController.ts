import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import twilio from 'twilio';
import { eventBus } from '../comms/eventBus';

const prisma = new PrismaClient();

export class TwilioWebhookController {
  
  static async handleInboundSms(req: FastifyRequest, reply: FastifyReply) {
    const { From, Body, To } = (req.body as any); // Twilio sends form-urlencoded data
    
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
      const twiml = new twilio.twiml.MessagingResponse();
      
      eventBus.broadcast('sms_received', { From, Body, To });
      
      reply.type('text/xml').send(twiml.toString());
    } catch (error) {
      console.error('Error handling inbound SMS:', error);
      reply.status(500).send('Internal Server Error');
    }
  }

  static async handleVoiceGather(req: FastifyRequest, reply: FastifyReply) {
    const { Digits } = (req.body as any);
    const twiml = new twilio.twiml.VoiceResponse();

    if (Digits === '1') {
      twiml.say('Connecting you to customer service.');
      twiml.dial(process.env.CUSTOMER_SERVICE_NUMBER || '+18005550199');
    } else {
      twiml.say('Invalid input. Goodbye.');
    }

    reply.type('text/xml').send(twiml.toString());
  }
}
