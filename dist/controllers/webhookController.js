"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeWebhook = void 0;
const stripeService_1 = require("../services/stripeService");
const stripeWebhook = (req, res) => {
    const sig = req.headers['stripe-signature'];
    if (!sig) {
        return res.status(400).send('Webhook Error: Missing signature');
    }
    let event;
    try {
        event = stripeService_1.stripeService.constructEvent(req.body, sig);
    }
    catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        // Handle successful payment
    }
    else if (event.type === 'payment_intent.payment_failed') {
        const paymentIntent = event.data.object;
        // Handle failed payment
    }
    res.json({ received: true });
};
exports.stripeWebhook = stripeWebhook;
