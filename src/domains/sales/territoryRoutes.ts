import { FastifyPluginAsync } from 'fastify';
import {
  getTerritories,
  getTerritoryById,
  createTerritory,
  updateTerritory,
  deleteTerritory,
  getTerritoryAnalytics,
  getDoNotKnockList,
  createDoNotKnock,
  deleteDoNotKnock
} from './territoryController';

const routes: FastifyPluginAsync = async (fastify, opts) => {

// Territory routes
fastify.get('/', getTerritories);
fastify.get('/:id', getTerritoryById);
fastify.post('/', createTerritory);
fastify.put('/:id', updateTerritory);
fastify.delete('/:id', deleteTerritory);
fastify.get('/:id/analytics', getTerritoryAnalytics);

// Do-Not-Knock compliance routes
fastify.get('/compliance/do-not-knock', getDoNotKnockList);
fastify.post('/compliance/do-not-knock', createDoNotKnock);
fastify.delete('/compliance/do-not-knock/:id', deleteDoNotKnock);

};

export default routes;
