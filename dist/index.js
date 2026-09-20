"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const jobRoutes_1 = __importDefault(require("./routes/jobRoutes"));
const contractRoutes_1 = __importDefault(require("./routes/contractRoutes"));
const technicianRoutes_1 = __importDefault(require("./routes/technicianRoutes"));
const canvassRoutes_1 = __importDefault(require("./routes/canvassRoutes"));
const customerRoutes_1 = __importDefault(require("./routes/customerRoutes"));
const hrRoutes_1 = __importDefault(require("./routes/hrRoutes"));
const financeRoutes_1 = __importDefault(require("./routes/financeRoutes"));
const twilioRoutes_1 = __importDefault(require("./routes/twilioRoutes"));
const routingRoutes_1 = __importDefault(require("./routes/routingRoutes"));
const analyticsRoutes_1 = __importDefault(require("./routes/analyticsRoutes"));
const dispatchRoutes_1 = __importDefault(require("./routes/dispatchRoutes"));
const agreementRoutes_1 = __importDefault(require("./routes/agreementRoutes"));
const NotificationCron_1 = require("./cron/NotificationCron");
const HealthScoreCron_1 = require("./cron/HealthScoreCron");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 8000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// API Routes
app.use('/api/v1/jobs', jobRoutes_1.default);
app.use('/api/v1/contracts', contractRoutes_1.default);
app.use('/api/v1/technicians', technicianRoutes_1.default);
app.use('/api/v1/sales', canvassRoutes_1.default);
app.use('/api/v1/customers', customerRoutes_1.default);
app.use('/api/v1/hr', hrRoutes_1.default);
app.use('/api/v1/finance', financeRoutes_1.default);
app.use('/api/v1/analytics', analyticsRoutes_1.default);
app.use('/api/v1/dispatch', dispatchRoutes_1.default);
// New Routes
app.use('/api/webhooks/twilio', twilioRoutes_1.default);
app.use('/api/v1/routing', routingRoutes_1.default);
app.use('/api/v1/agreements', agreementRoutes_1.default);
// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'express-api' });
});
app.listen(port, () => {
    console.log(`Express API running on port ${port}`);
    // Start the Notification Cron
    (0, NotificationCron_1.startNotificationCron)();
    (0, HealthScoreCron_1.startHealthScoreCron)();
});
