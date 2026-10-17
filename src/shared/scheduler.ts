import cron from 'node-cron';
import { inWorkerContext } from './database';
export default { schedule(expression: string, callback: (...args: any[]) => any, options?: any) {
  return cron.schedule(expression, (...args: any[]) => inWorkerContext(() => callback(...args)), options);
} };
