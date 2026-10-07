import request from 'supertest';
import fastify from 'fastify';

let fastifyApp: ReturnType<typeof fastify>;
let app: any;

beforeAll(async () => {
  fastifyApp = fastify();
  fastifyApp.get('/health', async (req: any, reply: any) => {
    reply.send({ status: 'ok', service: 'express-api' });
  });
  await fastifyApp.ready();
  app = fastifyApp.server;
});

afterAll(async () => {
  await fastifyApp.close();
});
describe('Health Check API', () => {
  it('should return status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('status', 'ok');
  });
});
