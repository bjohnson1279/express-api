import { FastifyRequest, FastifyReply } from 'fastify';
import { stripeService } from './stripeService';

export const stripeWebhook = (req: FastifyRequest, reply: FastifyReply) => {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    return reply.status(400).send('Webhook Error: Missing signature');
  }

  let event;

  try {
    event = stripeService.constructEvent((req.body as any), sig as string);
  } catch (err: any) {
    return reply.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    // Handle successful payment
  } else if (event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object;
    // Handle failed payment
  }

  reply.send({ received: true });
};
