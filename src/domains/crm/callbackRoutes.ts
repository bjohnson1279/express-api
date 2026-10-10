import { FastifyPluginAsync } from 'fastify';
import { callbackActor, callbackCommand, CallbackError } from './callbackService';

const routes: FastifyPluginAsync = async app => {
  app.get('/events', async (req, reply) => {
    try {
      const first = await callbackCommand(callbackActor(req.headers.authorization),'list');
      reply.hijack();
      reply.raw.writeHead(200,{ 'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no' });
      let last = JSON.stringify(first); let running = false;
      reply.raw.write(`event: callbacks\ndata: ${last}\n\n`);
      const timer = setInterval(async () => {
        if (running) return; running = true;
        try {
          const value = JSON.stringify(await callbackCommand(callbackActor(req.headers.authorization),'list'));
          if (value !== last) { last = value; reply.raw.write(`event: callbacks\ndata: ${value}\n\n`); }
          else reply.raw.write(': keepalive\n\n');
        } catch { clearInterval(timer); reply.raw.end(); }
        finally { running = false; }
      },15000);
      reply.raw.on('close',() => clearInterval(timer));
    } catch (error) {
      const e = error instanceof CallbackError ? error : new CallbackError(500,'Callback stream failed');
      return reply.code(e.status).send({error:e.message});
    }
  });
  const route = (method: 'GET' | 'POST', url: string, action: string) => app.route({
    method, url, bodyLimit: 1500000,
    handler: async (req, reply) => {
      try {
        const actor = callbackActor(req.headers.authorization);
        const body = { ...(method === 'GET' ? req.query as object : req.body as object), ...req.params as object };
        return await callbackCommand(actor, action, body);
      } catch (error) {
        const e = error instanceof CallbackError ? error : new CallbackError(500, 'Callback operation failed');
        return reply.code(e.status).send({ error: e.message });
      }
    }
  });
  route('GET', '/settings', 'settings'); route('POST', '/settings', 'settings');
  route('GET', '/options', 'options');
  route('GET', '/report', 'report');
  route('GET', '/policies', 'policies'); route('POST', '/policies', 'create_policy');
  route('POST', '/policies/assign', 'assign_policy');
  route('GET', '/', 'list'); route('POST', '/', 'create');
  route('GET', '/:id', 'get');
  route('GET', '/:id/attachments/:attachment_id', 'attachment_get');
  for (const [path, action] of Object.entries({ 'assess-coverage': 'assess', decision: 'decision', quotes: 'quote', visits: 'visit', 'visit-cost': 'visit_cost', 'visit-update': 'visit_update', outcome: 'outcome', resolution: 'resolve', reopen: 'reopen', cancel: 'cancel', reply: 'reply', 'accept-quote': 'accept_quote', attachments: 'attachment' })) {
    route('POST', `/:id/${path}`, action);
  }
};
export default routes;
