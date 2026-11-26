import { Router } from 'express';
import { aiPromptController } from '../controllers/ai_prompt.controller';

const router = Router();
router.get('/ai-logs', (req, res, next) => aiPromptController.getLogs(req, res, next));
router.post('/ai-logs', (req, res, next) => aiPromptController.logPrompt(req, res, next));
export default router;
