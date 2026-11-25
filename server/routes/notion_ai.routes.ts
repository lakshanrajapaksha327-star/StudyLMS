import { Router } from 'express';
import { notionAiController } from '../controllers/notion_ai.controller';

const router = Router();

router.post('/notion-ai', (req, res) => notionAiController.processNoteAction(req, res));

export default router;
