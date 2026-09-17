import { Router } from 'express';
import { RoutingService } from '../services/RoutingService';

const router = Router();
const routingService = new RoutingService();

router.post('/optimize', async (req, res) => {
  try {
    const { coordinates } = req.body;
    if (!coordinates || !Array.isArray(coordinates)) {
      return res.status(400).json({ error: 'Coordinates array required' });
    }
    
    const result = await routingService.optimizeRoute(coordinates);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
