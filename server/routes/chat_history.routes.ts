import { Router } from 'express';
import { chatHistoryController } from '../controllers/chat_history.controller';

const router = Router();

router.get('/chat-history/search', (req, res) =>
  chatHistoryController.searchSessions(req, res)
);
router.get('/chat-history/sessions', (req, res) =>
  chatHistoryController.getSessions(req, res)
);
router.get('/chat-history/sessions/:id', (req, res) =>
  chatHistoryController.getSessionById(req, res)
);
router.post('/chat-history/sessions', (req, res) =>
  chatHistoryController.createSession(req, res)
);
router.patch('/chat-history/sessions/:id/rename', (req, res) =>
  chatHistoryController.renameSession(req, res)
);
router.patch('/chat-history/sessions/:id/archive', (req, res) =>
  chatHistoryController.archiveSession(req, res)
);
router.delete('/chat-history/sessions/:id', (req, res) =>
  chatHistoryController.deleteSession(req, res)
);
router.delete('/chat-history/clear-all', (req, res) =>
  chatHistoryController.clearAll(req, res)
);

export default router;
