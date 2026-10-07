"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeService = void 0;
const stripe_1 = __importDefault(require("stripe"));
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
    // @ts-ignore
    apiVersion: '2023-10-16',
});
exports.stripeService = {
    createCustomer: async (email, name) => {
        return stripe.customers.create({ email, name });
    },
    createPaymentIntent: async (amount, currency, customerId) => {
        return stripe.paymentIntents.create({
            amount,
            currency,
            customer: customerId,
        });
    },
    constructEvent: (payload, signature) => {
        return stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET || '');
    },
    chargeCustomer: async (customerId, amount, currency = 'usd') => {
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
