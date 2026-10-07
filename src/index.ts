import fastifyLib, { FastifyRequest, FastifyReply } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
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
import { startPreVisitNotificationCron } from './domains/comms/PreVisitNotificationCron';

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

const fastify = fastifyLib({ logger: true, trustProxy: true });
const port = process.env.PORT || 8000;

async function startFastify() {
  await fastify.register(fastifyCors);
  await fastify.register(fastifyMultipart);
  
  // Apply rate limiting and usage metering globally to all API routes
  await fastify.register(apiLimiter);
  
  fastify.addHook('onResponse', usageMetering);
  fastify.addHook('onResponse', auditMiddleware);

  // === Dispatch Domain ===
  fastify.register(async (app) => {
    app.addHook('onRequest', verifyToken);
    app.register(jobRoutes, { prefix: '/jobs' });
    app.register(technicianRoutes, { prefix: '/technicians' });
    
    app.register(async (authApp) => {
      authApp.addHook('onRequest', requireRole(['SUPER_ADMIN', 'DISPATCHER', 'MANAGER']));
      authApp.register(dispatchRoutes, { prefix: '/dispatch' });
    });
    
    app.register(async (authApp) => {
      authApp.addHook('onRequest', requireRole(['SUPER_ADMIN', 'MANAGER']));
      authApp.register(inventoryRoutes, { prefix: '/inventory' });
    });
  }, { prefix: '/api/v1' });

  fastify.register(routingRoutes, { prefix: '/api/v1/routing' });
  fastify.register(bookingRoutes, { prefix: '/api/v1/booking' });

  // === Billing Domain ===
  fastify.register(async (app) => {
    app.addHook('onRequest', verifyToken);
    app.addHook('onRequest', requireRole(['SUPER_ADMIN', 'MANAGER']));
    app.register(financeRoutes, { prefix: '/finance' });
  }, { prefix: '/api/v1' });

  // === CRM Domain ===
  fastify.register(async (app) => {
    app.addHook('onRequest', verifyToken);
    app.register(customerRoutes, { prefix: '/customers' });
    app.register(contractRoutes, { prefix: '/contracts' });
  }, { prefix: '/api/v1' });
  
  fastify.register(propertyRoutes, { prefix: '/api/v1/properties' });
  fastify.register(surveyRoutes, { prefix: '/api/v1/surveys' });

  // === Communications Domain ===
  fastify.register(twilioRoutes, { prefix: '/api/webhooks/twilio' });
  fastify.register(eventRoutes, { prefix: '/api/events' });
  fastify.register(chatRoutes, { prefix: '/api/v1/comms/chat' });

  // === Sales Domain ===
  fastify.register(async (app) => {
    app.addHook('onRequest', verifyToken);
    
    app.register(async (authApp) => {
      authApp.addHook('onRequest', requireRole(['SUPER_ADMIN', 'DOOR_TO_DOOR_SALES', 'MANAGER']));
      authApp.register(canvassRoutes, { prefix: '/sales' });
      authApp.register(territoryRoutes, { prefix: '/sales/territories' });
    });

    app.register(async (authApp) => {
      authApp.addHook('onRequest', requireRole(['SUPER_ADMIN', 'MANAGER']));
      authApp.register(marketingRoutes, { prefix: '/marketing' });
    });
  }, { prefix: '/api/v1' });
  
  fastify.register(agreementRoutes, { prefix: '/api/v1/agreements' });

  // === HR Domain ===
  fastify.register(async (app) => {
    app.addHook('onRequest', verifyToken);
    app.addHook('onRequest', requireRole(['SUPER_ADMIN', 'MANAGER']));
    app.register(hrRoutes, { prefix: '/hr' });
  }, { prefix: '/api/v1' });

  // === Analytics Domain ===
  fastify.register(async (app) => {
    app.addHook('onRequest', verifyToken);
    app.register(analyticsRoutes, { prefix: '/analytics' });
  }, { prefix: '/api/v1' });

  // Health Check
  fastify.get('/health', async (req: FastifyRequest, reply: FastifyReply) => {
    reply.send({ status: 'ok', service: 'fastify-api' });
  });

  // Start Fastify
  fastify.listen({ port: typeof port === 'string' ? parseInt(port) : port, host: '0.0.0.0' }, () => {
    console.log(`Fastify API running on port ${port}`);
    
    // Start all domain crons
    startNotificationCron();
    startPreVisitNotificationCron();
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
