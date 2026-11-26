import { Router } from 'express';
import { chatController } from '../controllers/chat.controller';

const router = Router();
router.post('/chat', (req, res, next) => chatController.handleChat(req, res, next));
export default router;
