"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const eventBus_1 = require("../comms/eventBus");
const routes = async (fastify, opts) => {
    fastify.get('/', (req, reply) => {
        reply.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        });
        // Tell the client that the connection is open
        reply.write('data: {"type": "connected"}\n\n');
        eventBus_1.eventBus.subscribe(res);
        req.on('close', () => {
            eventBus_1.eventBus.unsubscribe(res);
        });
    });
};
exports.default = routes;
