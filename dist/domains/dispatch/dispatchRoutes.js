"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dispatchController_1 = require("./dispatchController");
const routes = async (fastify, opts) => {
    fastify.post('/optimize', dispatchController_1.optimizeRoute);
    fastify.post('/emergency', dispatchController_1.emergencyDispatch);
    fastify.post('/auto-schedule', dispatchController_1.autoSchedule);
    fastify.post('/commit-schedule', dispatchController_1.commitSchedule);
};
exports.default = routes;
