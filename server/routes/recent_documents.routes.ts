import { Router } from 'express';
import { recentDocumentsController } from '../controllers/recent_documents.controller';

const router = Router();
router.get('/recent-documents', (req, res, next) =>
  recentDocumentsController.getRecentDocuments(req, res, next)
);
router.post('/recent-documents', (req, res, next) =>
  recentDocumentsController.recordAccess(req, res, next)
);
export default router;
