import { Router } from 'express';
import { aiPromptController } from '../controllers/ai_prompt.controller';

const router = Router();

router.get('/ai-logs', (req, res) => aiPromptController.getLogs(req, res));
router.post('/ai-logs', (req, res) => aiPromptController.logPrompt(req, res));

export default router;
