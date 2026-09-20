import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jobRoutes from './routes/jobRoutes';
import contractRoutes from './routes/contractRoutes';
import technicianRoutes from './routes/technicianRoutes';
import canvassRoutes from './routes/canvassRoutes';
import customerRoutes from './routes/customerRoutes';
import hrRoutes from './routes/hrRoutes';
import financeRoutes from './routes/financeRoutes';
import twilioRoutes from './routes/twilioRoutes';
import routingRoutes from './routes/routingRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import dispatchRoutes from './routes/dispatchRoutes';
import agreementRoutes from './routes/agreementRoutes';
import eventRoutes from './routes/eventRoutes';
import { startNotificationCron } from './cron/NotificationCron';
import { startHealthScoreCron } from './cron/HealthScoreCron';
import { startJobGenerationCron } from './cron/JobGenerationCron';

dotenv.config();

const app = express();
const port = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/v1/jobs', jobRoutes);
app.use('/api/v1/contracts', contractRoutes);
app.use('/api/v1/technicians', technicianRoutes);
app.use('/api/v1/sales', canvassRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/hr', hrRoutes);
app.use('/api/v1/finance', financeRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/dispatch', dispatchRoutes);

import propertyRoutes from './routes/propertyRoutes';
import path from 'path';

// New Routes
app.use('/api/webhooks/twilio', twilioRoutes);
app.use('/api/v1/routing', routingRoutes);
app.use('/api/v1/agreements', agreementRoutes);
app.use('/api/v1/properties', propertyRoutes);

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// SSE Event Stream
app.use('/api/events', eventRoutes);

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'express-api' });
});

app.listen(port, () => {
  console.log(`Express API running on port ${port}`);
  
  // Start the Notification Cron
  startNotificationCron();
  startHealthScoreCron();
  startJobGenerationCron();
});
