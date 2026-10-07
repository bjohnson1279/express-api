"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeWebhook = void 0;
const stripeService_1 = require("./stripeService");
const stripeWebhook = (req, reply) => {
    const sig = req.headers['stripe-signature'];
    if (!sig) {
        return reply.status(400).send('Webhook Error: Missing signature');
    }
    let event;
    try {
        event = stripeService_1.stripeService.constructEvent(req.body, sig);
    }
    catch (err) {
        return reply.status(400).send(`Webhook Error: ${err.message}`);
    }
    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        // Handle successful payment
    }
    else if (event.type === 'payment_intent.payment_failed') {
        const paymentIntent = event.data.object;
        // Handle failed payment
    }
    reply.send({ received: true });
};
exports.stripeWebhook = stripeWebhook;
