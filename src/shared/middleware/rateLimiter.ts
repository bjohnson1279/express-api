import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379;
const redisPassword = process.env.REDIS_PASSWORD || 'redis_password';

export const redisClient = new Redis({
  host: redisHost,
  port: redisPort,
  password: redisPassword
});

// 100 requests per 15 minutes per user/tenant
export const apiLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.call(...args),
  }),
  windowMs: 15 * 60 * 1000, 
  max: 100, 
  standardHeaders: true, 
  legacyHeaders: false, 
  keyGenerator: (req: any) => {
    // Rate limit per tenant + user, fallback to IP
    if (req.user?.tenantId && req.user?.id) {
      return `${req.user.tenantId}:${req.user.id}`;
    }
    return req.ip || 'unknown-ip';
  },
  handler: (req, res, next, options) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'You have exceeded your API rate limit. Please try again later.'
    });
  }
});
