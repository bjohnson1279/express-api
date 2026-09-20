"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const RoutingService_1 = require("../services/RoutingService");
const router = (0, express_1.Router)();
const routingService = new RoutingService_1.RoutingService();
router.post('/optimize', async (req, res) => {
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
exports.default = router;
