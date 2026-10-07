"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jobController_1 = require("./jobController");
const routes = async (fastify, opts) => {
    fastify.get('/calendar', jobController_1.getJobsCalendar);
    fastify.get('/', jobController_1.getJobs);
    fastify.post('/', jobController_1.createJob);
    fastify.patch('/:id', jobController_1.updateJob);
    fastify.post('/:id/clock-in', jobController_1.clockIn);
    fastify.post('/:id/clock-out', jobController_1.clockOut);
};
exports.default = routes;
