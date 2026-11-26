import { Router } from 'express';
import { notionAiController } from '../controllers/notion_ai.controller';

const router = Router();
router.post('/notion-ai', (req, res, next) =>
  notionAiController.processNoteAction(req, res, next)
);
export default router;
