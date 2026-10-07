import { FastifyPluginAsync } from 'fastify';
import { ChatController } from './chatController';

const routes: FastifyPluginAsync = async (fastify, opts) => {

// Conversations
fastify.get('/conversations', ChatController.getConversations);
fastify.post('/conversations', ChatController.createConversation);
fastify.get('/conversations/:id', ChatController.getConversation);
fastify.patch('/conversations/:id', ChatController.updateConversation);
fastify.put('/conversations/:id', ChatController.updateConversation);

// Messages
fastify.post('/conversations/:id/messages', ChatController.sendMessage);

// Canned Responses
fastify.get('/canned-responses', ChatController.getCannedResponses);
fastify.post('/canned-responses', ChatController.createCannedResponse);

};

export default routes;
