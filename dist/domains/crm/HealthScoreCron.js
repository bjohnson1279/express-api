"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startHealthScoreCron = startHealthScoreCron;
const node_cron_1 = __importDefault(require("node-cron"));
const HealthScoreService_1 = require("./HealthScoreService");
const healthScoreService = new HealthScoreService_1.HealthScoreService();
function startHealthScoreCron() {
    // Run nightly at 2:00 AM
    node_cron_1.default.schedule('0 2 * * *', async () => {
        console.log('Running nightly health score recalculation...');
        try {
            await healthScoreService.calculateForAllCustomers();
        }
        catch (error) {
            console.error('Error in health score cron:', error);
        }
    });
}
