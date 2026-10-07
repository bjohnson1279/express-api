"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const territoryController_1 = require("./territoryController");
const routes = async (fastify, opts) => {
    // Territory routes
    fastify.get('/', territoryController_1.getTerritories);
    fastify.get('/:id', territoryController_1.getTerritoryById);
    fastify.post('/', territoryController_1.createTerritory);
    fastify.put('/:id', territoryController_1.updateTerritory);
    fastify.delete('/:id', territoryController_1.deleteTerritory);
    fastify.get('/:id/analytics', territoryController_1.getTerritoryAnalytics);
    // Do-Not-Knock compliance routes
    fastify.get('/compliance/do-not-knock', territoryController_1.getDoNotKnockList);
    fastify.post('/compliance/do-not-knock', territoryController_1.createDoNotKnock);
    fastify.delete('/compliance/do-not-knock/:id', territoryController_1.deleteDoNotKnock);
};
exports.default = routes;
