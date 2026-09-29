import { Router } from 'express';
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

const router = Router();

// Territory routes
router.get('/', getTerritories);
router.get('/:id', getTerritoryById);
router.post('/', createTerritory);
router.put('/:id', updateTerritory);
router.delete('/:id', deleteTerritory);
router.get('/:id/analytics', getTerritoryAnalytics);

// Do-Not-Knock compliance routes
router.get('/compliance/do-not-knock', getDoNotKnockList);
router.post('/compliance/do-not-knock', createDoNotKnock);
router.delete('/compliance/do-not-knock/:id', deleteDoNotKnock);

export default router;
