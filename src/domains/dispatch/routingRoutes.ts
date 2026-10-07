import { FastifyPluginAsync } from 'fastify';
import { RoutingService } from './RoutingService';

const routes: FastifyPluginAsync = async (fastify, opts) => {
const routingService = new RoutingService();

fastify.post('/optimize', async (req, res) => {
  try {
    const { coordinates } = (req.body as any);
    if (!coordinates || !Array.isArray(coordinates)) {
      return res.status(400).send({ error: 'Coordinates array required' });
    }
    
    const result = await routingService.optimizeRoute(coordinates);
    res.send(result);
  } catch (error: any) {
    res.status(500).send({ error: error.message });
  }
});

};

export default routes;
