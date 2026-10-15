import { authenticate } from '../../shared/auth/session';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { eventBus } from '../comms/eventBus';

const routes: FastifyPluginAsync = async (fastify, opts) => {

fastify.get('/', (req: FastifyRequest, reply: FastifyReply) => {
  reply.hijack();
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  
  // Tell the client that the connection is open
  reply.raw.write('data: {"type": "connected"}\n\n');

  eventBus.subscribe(reply, (req as any).user.tenantId);
  const expiry = setInterval(() => { void authenticate(req.headers.authorization).catch(() => reply.raw.end()); }, 60000);
  expiry.unref();

  reply.raw.on('close', () => {
    clearInterval(expiry);
    eventBus.unsubscribe(reply);
  });
});

};

export default routes;
