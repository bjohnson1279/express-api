"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bookingController_1 = require("./bookingController");
const routes = async (fastify, opts) => {
    fastify.get('/slots', bookingController_1.getAvailableSlots);
    fastify.post('/', bookingController_1.createBooking);
};
exports.default = routes;
