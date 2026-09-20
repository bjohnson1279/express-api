import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  // @ts-ignore
  apiVersion: '2023-10-16',
});

export const stripeService = {
  createCustomer: async (email: string, name: string) => {
    return stripe.customers.create({ email, name });
  },

  createPaymentIntent: async (amount: number, currency: string, customerId: string) => {
    return stripe.paymentIntents.create({
      amount,
      currency,
      customer: customerId,
    });
  },

  constructEvent: (payload: Buffer, signature: string) => {
    return stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
  },

  chargeCustomer: async (customerId: string, amount: number, currency = 'usd') => {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    if (paymentMethods.data.length === 0) {
      throw new Error('No payment methods found');
    }

    return stripe.paymentIntents.create({
      amount,
      currency,
      customer: customerId,
      payment_method: paymentMethods.data[0].id,
      off_session: true,
      confirm: true,
    });
  },
};
