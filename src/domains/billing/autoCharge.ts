import cron from 'node-cron';
import { stripeService } from './stripeService';

export const startAutoChargeCron = () => {
  cron.schedule('0 0 * * *', async () => {
    console.log('Running auto-charge recurring contracts...');
    // Fetch due contracts and charge
    // await stripeService.chargeCustomer(...)
  });
};
