"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiLimiter = exports.redisClient = void 0;
const rate_limit_1 = __importDefault(require("@fastify/rate-limit"));
const ioredis_1 = __importDefault(require("ioredis"));
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379;
const redisPassword = process.env.REDIS_PASSWORD || 'redis_password';
exports.redisClient = new ioredis_1.default({
    host: redisHost,
    port: redisPort,
    password: redisPassword
});
const apiLimiter = async (fastify, opts) => {
    await fastify.register(rate_limit_1.default, {
        max: 100,
        timeWindow: 15 * 60 * 1000,
        redis: exports.redisClient,
        keyGenerator: (req) => {
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
exports.apiLimiter = apiLimiter;
