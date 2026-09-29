import { Router } from 'express';
import { ChatController } from './chatController';

const router = Router();

// Conversations
router.get('/conversations', ChatController.getConversations);
router.post('/conversations', ChatController.createConversation);
router.get('/conversations/:id', ChatController.getConversation);
router.patch('/conversations/:id', ChatController.updateConversation);
router.put('/conversations/:id', ChatController.updateConversation);

// Messages
router.post('/conversations/:id/messages', ChatController.sendMessage);

// Canned Responses
router.get('/canned-responses', ChatController.getCannedResponses);
router.post('/canned-responses', ChatController.createCannedResponse);

export default router;
