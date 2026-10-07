"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const marketingController_1 = require("./marketingController");
const routes = async (fastify, opts) => {
    fastify.get('/campaigns', marketingController_1.getCampaigns);
    fastify.post('/campaigns', marketingController_1.createCampaign);
    fastify.post('/followups', marketingController_1.scheduleFollowup);
};
exports.default = routes;
