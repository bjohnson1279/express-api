import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { eventBus } from '../comms/eventBus';

const routes: FastifyPluginAsync = async (fastify, opts) => {

fastify.get('/', (req: FastifyRequest, reply: FastifyReply) => {
  reply.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  
  // Tell the client that the connection is open
  reply.write('data: {"type": "connected"}\n\n');

  eventBus.subscribe(res);

  req.on('close', () => {
    eventBus.unsubscribe(res);
  });
});

};

export default routes;
