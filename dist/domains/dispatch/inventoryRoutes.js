"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const inventoryController_1 = require("./inventoryController");
const routes = async (fastify, opts) => {
    fastify.get('/items', inventoryController_1.getInventoryItems);
    fastify.post('/items', inventoryController_1.createInventoryItem);
    fastify.patch('/items/:id/quantity', inventoryController_1.updateInventoryQuantity);
    fastify.get('/orders', inventoryController_1.getPurchaseOrders);
    fastify.get('/purchase-orders', inventoryController_1.getPurchaseOrders);
    fastify.post('/orders', inventoryController_1.createPurchaseOrder);
    fastify.post('/purchase-orders', inventoryController_1.createPurchaseOrder);
    // Chemical logging & EPA Compliance
    fastify.post('/chemical-logs', inventoryController_1.recordChemicalApplication);
    fastify.get('/epa-report', inventoryController_1.getEpaComplianceReport);
};
exports.default = routes;
