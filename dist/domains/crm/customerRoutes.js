"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const customerController_1 = require("./customerController");
const routes = async (fastify, opts) => {
    fastify.get('/', customerController_1.getCustomers);
    fastify.get('/:id', customerController_1.getCustomer);
    fastify.get('/:id/preferences', customerController_1.getPreferences);
    fastify.put('/:id/preferences', customerController_1.updatePreferences);
};
exports.default = routes;
