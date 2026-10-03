import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Domain: Dispatch
import jobRoutes from './domains/dispatch/jobRoutes';
import technicianRoutes from './domains/dispatch/technicianRoutes';
import dispatchRoutes from './domains/dispatch/dispatchRoutes';
import routingRoutes from './domains/dispatch/routingRoutes';
import inventoryRoutes from './domains/dispatch/inventoryRoutes';
import bookingRoutes from './domains/dispatch/bookingRoutes';
import { startJobGenerationCron } from './domains/dispatch/JobGenerationCron';
import { startInventoryCron } from './domains/dispatch/InventoryCron';

// Domain: Billing
import financeRoutes from './domains/billing/financeRoutes';

// Domain: CRM
import customerRoutes from './domains/crm/customerRoutes';
import contractRoutes from './domains/crm/contractRoutes';
import propertyRoutes from './domains/crm/propertyRoutes';
import surveyRoutes from './domains/crm/surveyRoutes';
import { startHealthScoreCron } from './domains/crm/HealthScoreCron';

// Domain: Communications
import twilioRoutes from './domains/comms/twilioRoutes';
import eventRoutes from './domains/comms/eventRoutes';
import chatRoutes from './domains/comms/chatRoutes';
import { startNotificationCron } from './domains/comms/NotificationCron';

// Domain: Sales
import canvassRoutes from './domains/sales/canvassRoutes';
import agreementRoutes from './domains/sales/agreementRoutes';
import marketingRoutes from './domains/sales/marketingRoutes';
import territoryRoutes from './domains/sales/territoryRoutes';
import { startFollowUpCron } from './domains/sales/FollowUpCron';

// Domain: HR
import hrRoutes from './domains/hr/hrRoutes';

// Domain: Analytics
import analyticsRoutes from './domains/analytics/analyticsRoutes';

// Shared
import { verifyToken, requireRole } from './shared/middleware/authMiddleware';
import { apiLimiter } from './shared/middleware/rateLimiter';
import { usageMetering } from './shared/middleware/usageMetering';
import { auditMiddleware } from './shared/middleware/auditMiddleware';

dotenv.config();

const expressApp = express();
const app = expressApp; // temp alias for routes

const port = process.env.PORT || 8000;

// Need trust proxy if behind load balancer/docker proxy
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

// Apply rate limiting and usage metering globally to all API routes
app.use('/api', apiLimiter);
app.use('/api', usageMetering);
app.use('/api', auditMiddleware);

// === Dispatch Domain ===
app.use('/api/v1/jobs', verifyToken, jobRoutes);
app.use('/api/v1/technicians', verifyToken, technicianRoutes);
app.use('/api/v1/dispatch', verifyToken, requireRole(['SUPER_ADMIN', 'DISPATCHER', 'MANAGER']), dispatchRoutes);
app.use('/api/v1/routing', routingRoutes);
app.use('/api/v1/inventory', verifyToken, requireRole(['SUPER_ADMIN', 'MANAGER']), inventoryRoutes);
app.use('/api/v1/booking', bookingRoutes);

// === Billing Domain ===
app.use('/api/v1/finance', verifyToken, requireRole(['SUPER_ADMIN', 'MANAGER']), financeRoutes);

// === CRM Domain ===
app.use('/api/v1/customers', verifyToken, customerRoutes);
app.use('/api/v1/contracts', verifyToken, contractRoutes);
app.use('/api/v1/properties', propertyRoutes);
app.use('/api/v1/surveys', surveyRoutes);

// === Communications Domain ===
app.use('/api/webhooks/twilio', twilioRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/v1/comms/chat', chatRoutes);

// === Sales Domain ===
app.use('/api/v1/sales', verifyToken, requireRole(['SUPER_ADMIN', 'DOOR_TO_DOOR_SALES', 'MANAGER']), canvassRoutes);
app.use('/api/v1/sales/territories', verifyToken, requireRole(['SUPER_ADMIN', 'DOOR_TO_DOOR_SALES', 'MANAGER']), territoryRoutes);
app.use('/api/v1/agreements', agreementRoutes);
app.use('/api/v1/marketing', verifyToken, requireRole(['SUPER_ADMIN', 'MANAGER']), marketingRoutes);

// === HR Domain ===
app.use('/api/v1/hr', verifyToken, requireRole(['SUPER_ADMIN', 'MANAGER']), hrRoutes);

// === Analytics Domain ===
app.use('/api/v1/analytics', verifyToken, analyticsRoutes);

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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
  
  // Start all domain crons
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
