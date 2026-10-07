"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const multipart_1 = __importDefault(require("@fastify/multipart"));
const dotenv_1 = __importDefault(require("dotenv"));
// Domain: Dispatch
const jobRoutes_1 = __importDefault(require("./domains/dispatch/jobRoutes"));
const technicianRoutes_1 = __importDefault(require("./domains/dispatch/technicianRoutes"));
const dispatchRoutes_1 = __importDefault(require("./domains/dispatch/dispatchRoutes"));
const routingRoutes_1 = __importDefault(require("./domains/dispatch/routingRoutes"));
const inventoryRoutes_1 = __importDefault(require("./domains/dispatch/inventoryRoutes"));
const bookingRoutes_1 = __importDefault(require("./domains/dispatch/bookingRoutes"));
const JobGenerationCron_1 = require("./domains/dispatch/JobGenerationCron");
const InventoryCron_1 = require("./domains/dispatch/InventoryCron");
// Domain: Billing
const financeRoutes_1 = __importDefault(require("./domains/billing/financeRoutes"));
// Domain: CRM
const customerRoutes_1 = __importDefault(require("./domains/crm/customerRoutes"));
const contractRoutes_1 = __importDefault(require("./domains/crm/contractRoutes"));
const propertyRoutes_1 = __importDefault(require("./domains/crm/propertyRoutes"));
const surveyRoutes_1 = __importDefault(require("./domains/crm/surveyRoutes"));
const HealthScoreCron_1 = require("./domains/crm/HealthScoreCron");
// Domain: Communications
const twilioRoutes_1 = __importDefault(require("./domains/comms/twilioRoutes"));
const eventRoutes_1 = __importDefault(require("./domains/comms/eventRoutes"));
const chatRoutes_1 = __importDefault(require("./domains/comms/chatRoutes"));
const NotificationCron_1 = require("./domains/comms/NotificationCron");
const PreVisitNotificationCron_1 = require("./domains/comms/PreVisitNotificationCron");
// Domain: Sales
const canvassRoutes_1 = __importDefault(require("./domains/sales/canvassRoutes"));
const agreementRoutes_1 = __importDefault(require("./domains/sales/agreementRoutes"));
const marketingRoutes_1 = __importDefault(require("./domains/sales/marketingRoutes"));
const territoryRoutes_1 = __importDefault(require("./domains/sales/territoryRoutes"));
const FollowUpCron_1 = require("./domains/sales/FollowUpCron");
// Domain: HR
const hrRoutes_1 = __importDefault(require("./domains/hr/hrRoutes"));
// Domain: Analytics
const analyticsRoutes_1 = __importDefault(require("./domains/analytics/analyticsRoutes"));
// Shared
const authMiddleware_1 = require("./shared/middleware/authMiddleware");
const rateLimiter_1 = require("./shared/middleware/rateLimiter");
const usageMetering_1 = require("./shared/middleware/usageMetering");
const auditMiddleware_1 = require("./shared/middleware/auditMiddleware");
dotenv_1.default.config();
const fastify = (0, fastify_1.default)({ logger: true, trustProxy: true });
const port = process.env.PORT || 8000;
async function startFastify() {
    await fastify.register(cors_1.default);
    await fastify.register(multipart_1.default);
    // Apply rate limiting and usage metering globally to all API routes
    await fastify.register(rateLimiter_1.apiLimiter);
    fastify.addHook('onResponse', usageMetering_1.usageMetering);
    fastify.addHook('onResponse', auditMiddleware_1.auditMiddleware);
    // === Dispatch Domain ===
    fastify.register(async (app) => {
        app.addHook('onRequest', authMiddleware_1.verifyToken);
        app.register(jobRoutes_1.default, { prefix: '/jobs' });
        app.register(technicianRoutes_1.default, { prefix: '/technicians' });
        app.register(async (authApp) => {
            authApp.addHook('onRequest', (0, authMiddleware_1.requireRole)(['SUPER_ADMIN', 'DISPATCHER', 'MANAGER']));
            authApp.register(dispatchRoutes_1.default, { prefix: '/dispatch' });
        });
        app.register(async (authApp) => {
            authApp.addHook('onRequest', (0, authMiddleware_1.requireRole)(['SUPER_ADMIN', 'MANAGER']));
            authApp.register(inventoryRoutes_1.default, { prefix: '/inventory' });
        });
    }, { prefix: '/api/v1' });
    fastify.register(routingRoutes_1.default, { prefix: '/api/v1/routing' });
    fastify.register(bookingRoutes_1.default, { prefix: '/api/v1/booking' });
    // === Billing Domain ===
    fastify.register(async (app) => {
        app.addHook('onRequest', authMiddleware_1.verifyToken);
        app.addHook('onRequest', (0, authMiddleware_1.requireRole)(['SUPER_ADMIN', 'MANAGER']));
        app.register(financeRoutes_1.default, { prefix: '/finance' });
    }, { prefix: '/api/v1' });
    // === CRM Domain ===
    fastify.register(async (app) => {
        app.addHook('onRequest', authMiddleware_1.verifyToken);
        app.register(customerRoutes_1.default, { prefix: '/customers' });
        app.register(contractRoutes_1.default, { prefix: '/contracts' });
    }, { prefix: '/api/v1' });
    fastify.register(propertyRoutes_1.default, { prefix: '/api/v1/properties' });
    fastify.register(surveyRoutes_1.default, { prefix: '/api/v1/surveys' });
    // === Communications Domain ===
    fastify.register(twilioRoutes_1.default, { prefix: '/api/webhooks/twilio' });
    fastify.register(eventRoutes_1.default, { prefix: '/api/events' });
    fastify.register(chatRoutes_1.default, { prefix: '/api/v1/comms/chat' });
    // === Sales Domain ===
    fastify.register(async (app) => {
        app.addHook('onRequest', authMiddleware_1.verifyToken);
        app.register(async (authApp) => {
            authApp.addHook('onRequest', (0, authMiddleware_1.requireRole)(['SUPER_ADMIN', 'DOOR_TO_DOOR_SALES', 'MANAGER']));
            authApp.register(canvassRoutes_1.default, { prefix: '/sales' });
            authApp.register(territoryRoutes_1.default, { prefix: '/sales/territories' });
        });
        app.register(async (authApp) => {
            authApp.addHook('onRequest', (0, authMiddleware_1.requireRole)(['SUPER_ADMIN', 'MANAGER']));
            authApp.register(marketingRoutes_1.default, { prefix: '/marketing' });
        });
    }, { prefix: '/api/v1' });
    fastify.register(agreementRoutes_1.default, { prefix: '/api/v1/agreements' });
    // === HR Domain ===
    fastify.register(async (app) => {
        app.addHook('onRequest', authMiddleware_1.verifyToken);
        app.addHook('onRequest', (0, authMiddleware_1.requireRole)(['SUPER_ADMIN', 'MANAGER']));
        app.register(hrRoutes_1.default, { prefix: '/hr' });
    }, { prefix: '/api/v1' });
    // === Analytics Domain ===
    fastify.register(async (app) => {
        app.addHook('onRequest', authMiddleware_1.verifyToken);
        app.register(analyticsRoutes_1.default, { prefix: '/analytics' });
    }, { prefix: '/api/v1' });
    // Health Check
    fastify.get('/health', async (req, reply) => {
        reply.send({ status: 'ok', service: 'fastify-api' });
    });
    // Start Fastify
    fastify.listen({ port: typeof port === 'string' ? parseInt(port) : port, host: '0.0.0.0' }, () => {
        console.log(`Fastify API running on port ${port}`);
        // Start all domain crons
        (0, NotificationCron_1.startNotificationCron)();
        (0, PreVisitNotificationCron_1.startPreVisitNotificationCron)();
        (0, HealthScoreCron_1.startHealthScoreCron)();
        (0, JobGenerationCron_1.startJobGenerationCron)();
        (0, FollowUpCron_1.startFollowUpCron)();
        (0, InventoryCron_1.startInventoryCron)();
    });
}
startFastify().catch(err => {
    fastify.log.error(err);
    process.exit(1);
});
