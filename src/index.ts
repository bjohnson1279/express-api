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
import { startFollowUpCron } from './cron/FollowUpCron';
import { startInventoryCron } from './cron/InventoryCron';
import { verifyToken, requireRole } from './middleware/authMiddleware';

dotenv.config();

const expressApp = express();
const app = expressApp; // temp alias for routes

const port = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

import propertyRoutes from './routes/propertyRoutes';
import marketingRoutes from './routes/marketingRoutes';
import inventoryRoutes from './routes/inventoryRoutes';

// API Routes
app.use('/api/v1/jobs', verifyToken, jobRoutes);
app.use('/api/v1/contracts', verifyToken, contractRoutes);
app.use('/api/v1/technicians', verifyToken, technicianRoutes);
app.use('/api/v1/sales', verifyToken, requireRole(['SUPER_ADMIN', 'DOOR_TO_DOOR_SALES', 'MANAGER']), canvassRoutes);
app.use('/api/v1/customers', verifyToken, customerRoutes);
app.use('/api/v1/hr', verifyToken, requireRole(['SUPER_ADMIN', 'MANAGER']), hrRoutes);
app.use('/api/v1/finance', verifyToken, requireRole(['SUPER_ADMIN', 'MANAGER']), financeRoutes);
app.use('/api/v1/analytics', verifyToken, analyticsRoutes);
app.use('/api/v1/dispatch', verifyToken, requireRole(['SUPER_ADMIN', 'DISPATCHER', 'MANAGER']), dispatchRoutes);
app.use('/api/v1/marketing', verifyToken, requireRole(['SUPER_ADMIN', 'MANAGER']), marketingRoutes);
app.use('/api/v1/inventory', verifyToken, requireRole(['SUPER_ADMIN', 'MANAGER']), inventoryRoutes);
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


import fastifyLib from 'fastify';
import fastifyExpress from '@fastify/express';

const fastify = fastifyLib({ logger: true });

async function startFastify() {
  await fastify.register(fastifyExpress);
  fastify.use(expressApp);

  fastify.listen({ port: typeof port === 'string' ? parseInt(port) : port, host: '0.0.0.0' }, () => {
    console.log(`Fastify wrapper running on port ${port}`);
    
  console.log(`Express API running on port ${port}`);
  
  // Start the Notification Cron
  startNotificationCron();
  startHealthScoreCron();
  startJobGenerationCron();
  startFollowUpCron();
  startInventoryCron();

  });
}

startFastify().catch(err => {
  fastify.log.error(err);
  process.exit(1);
});

