import { FastifyPluginAsync } from 'fastify';
import { callbackActor, CallbackError, playbookCommand } from './playbookService';

const routes: FastifyPluginAsync = async app => {
  const route = (method: 'GET' | 'POST', url: string, action: string) =>
    app.route({
      method,
      url,
      bodyLimit: 200000,
      handler: async (req, reply) => {
        reply.header('Cache-Control', 'no-store');
        try {
          return await playbookCommand(callbackActor(req.headers.authorization), action, {
            ...(method === 'GET' ? (req.query as object) : (req.body as object)),
            ...(req.params as object),
          });
        } catch (error) {
          const e = error instanceof CallbackError ? error : new CallbackError(500, 'Playbook request failed');
          return reply.code(e.status).send({ error: e.message });
        }
      },
    });

  route('GET', '/settings', 'settings');
  route('POST', '/settings', 'settings');
  route('GET', '/options', 'options');
  route('POST', '/briefs', 'save_brief');
  route('POST', '/templates', 'publish_template');
  route('GET', '/', 'list');
  route('POST', '/', 'start_run');
  route('GET', '/:id', 'get');
  for (const action of ['acknowledge', 'save_run', 'submit', 'review']) {
    route('POST', '/:id/' + action, action);
  }
};

export default routes;
