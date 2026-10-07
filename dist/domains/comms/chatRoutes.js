"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chatController_1 = require("./chatController");
const routes = async (fastify, opts) => {
    // Conversations
    fastify.get('/conversations', chatController_1.ChatController.getConversations);
    fastify.post('/conversations', chatController_1.ChatController.createConversation);
    fastify.get('/conversations/:id', chatController_1.ChatController.getConversation);
    fastify.patch('/conversations/:id', chatController_1.ChatController.updateConversation);
    fastify.put('/conversations/:id', chatController_1.ChatController.updateConversation);
    // Messages
    fastify.post('/conversations/:id/messages', chatController_1.ChatController.sendMessage);
    // Canned Responses
    fastify.get('/canned-responses', chatController_1.ChatController.getCannedResponses);
    fastify.post('/canned-responses', chatController_1.ChatController.createCannedResponse);
};
exports.default = routes;
