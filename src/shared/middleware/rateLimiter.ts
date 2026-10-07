import fastifyRateLimit from '@fastify/rate-limit';
import Redis from 'ioredis';
import { FastifyPluginAsync } from 'fastify';

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379;
const redisPassword = process.env.REDIS_PASSWORD || 'redis_password';

export const redisClient = new Redis({
  host: redisHost,
  port: redisPort,
  password: redisPassword
});

export const apiLimiter: FastifyPluginAsync = async (fastify, opts) => {
  await fastify.register(fastifyRateLimit, {
    max: 100,
    timeWindow: 15 * 60 * 1000,
    redis: redisClient,
    keyGenerator: (req: any) => {
      if (req.user?.tenantId && req.user?.id) {
        return `${req.user.tenantId}:${req.user.id}`;
      }
      return req.ip || 'unknown-ip';
    },
    errorResponseBuilder: (req, context) => {
      return {
        error: 'Too Many Requests',
        message: 'You have exceeded your API rate limit. Please try again later.'
      };
    }
  });
};
