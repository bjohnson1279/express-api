"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startAutoChargeCron = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const startAutoChargeCron = () => {
    node_cron_1.default.schedule('0 0 * * *', async () => {
        console.log('Running auto-charge recurring contracts...');
        // Fetch due contracts and charge
        // await stripeService.chargeCustomer(...)
    });
};
exports.startAutoChargeCron = startAutoChargeCron;
