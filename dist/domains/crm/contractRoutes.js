"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const contractController_1 = require("./contractController");
const routes = async (fastify, opts) => {
    fastify.get('/', contractController_1.getContracts);
};
exports.default = routes;
