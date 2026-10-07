"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const technicianController_1 = require("./technicianController");
const routes = async (fastify, opts) => {
    fastify.get('/', technicianController_1.getTechnicians);
    fastify.get('/:id/schedule', technicianController_1.getTechnicianSchedule);
    fastify.patch('/:id/location', technicianController_1.updateLocation);
};
exports.default = routes;
