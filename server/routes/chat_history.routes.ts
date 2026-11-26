import { Router } from 'express';
import { chatHistoryController } from '../controllers/chat_history.controller';

const router = Router();

router.get('/chat-history/search', (req, res, next) =>
  chatHistoryController.searchSessions(req, res, next)
);
router.get('/chat-history/sessions', (req, res, next) =>
  chatHistoryController.getSessions(req, res, next)
);
router.get('/chat-history/sessions/:id', (req, res, next) =>
  chatHistoryController.getSessionById(req, res, next)
);
router.post('/chat-history/sessions', (req, res, next) =>
  chatHistoryController.createSession(req, res, next)
);
router.patch('/chat-history/sessions/:id/rename', (req, res, next) =>
  chatHistoryController.renameSession(req, res, next)
);
router.patch('/chat-history/sessions/:id/archive', (req, res, next) =>
  chatHistoryController.archiveSession(req, res, next)
);
router.delete('/chat-history/sessions/:id', (req, res, next) =>
  chatHistoryController.deleteSession(req, res, next)
);
router.delete('/chat-history/clear-all', (req, res, next) =>
  chatHistoryController.clearAll(req, res, next)
);

export default router;
