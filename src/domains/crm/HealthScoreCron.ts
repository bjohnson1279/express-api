import cron from 'node-cron';
import { HealthScoreService } from './HealthScoreService';

const healthScoreService = new HealthScoreService();

export function startHealthScoreCron() {
  // Run nightly at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('Running nightly health score recalculation...');
    try {
      await healthScoreService.calculateForAllCustomers();
    } catch (error) {
      console.error('Error in health score cron:', error);
    }
  });
}
