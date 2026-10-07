"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.verifyToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const verifyToken = async (req, reply) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // For development, if no JWT secret is set, we might mock a user
        if (process.env.NODE_ENV === 'development' && !process.env.JWT_SECRET) {
            req.user = { id: 'mock-admin-id', role: 'SUPER_ADMIN', tenantId: 'mock-tenant-id' };
            return;
        }
        return reply.status(401).send({ error: 'Missing or invalid token' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        req.user = decoded;
    }
    catch (error) {
        return reply.status(401).send({ error: 'Invalid token' });
    }
};
exports.verifyToken = verifyToken;
const requireRole = (roles) => {
    return async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Unauthorized' });
        }
        if (!roles.includes(req.user.role)) {
            return reply.status(403).send({ error: 'Forbidden: Insufficient permissions' });
        }
    };
};
exports.requireRole = requireRole;
