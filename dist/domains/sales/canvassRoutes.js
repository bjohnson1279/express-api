"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const canvassController_1 = require("./canvassController");
const routes = async (fastify, opts) => {
    fastify.get('/pins', canvassController_1.getCanvassPins);
};
exports.default = routes;
