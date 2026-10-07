"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const RoutingService_1 = require("./RoutingService");
const routes = async (fastify, opts) => {
    const routingService = new RoutingService_1.RoutingService();
    fastify.post('/optimize', async (req, res) => {
        try {
            const { coordinates } = req.body;
            if (!coordinates || !Array.isArray(coordinates)) {
                return res.status(400).json({ error: 'Coordinates array required' });
            }
            const result = await routingService.optimizeRoute(coordinates);
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
};
exports.default = routes;
