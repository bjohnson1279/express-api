import { Request, Response } from 'express';
import { stripeService } from './stripeService';

export const stripeWebhook = (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    return res.status(400).send('Webhook Error: Missing signature');
  }

  let event;

  try {
    event = stripeService.constructEvent(req.body, sig as string);
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    // Handle successful payment
  } else if (event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object;
    // Handle failed payment
  }

  res.json({ received: true });
};
