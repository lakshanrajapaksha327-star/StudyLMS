import { Router } from 'express';
import { recentDocumentsController } from '../controllers/recent_documents.controller';

const router = Router();

router.get('/recent-documents', (req, res) =>
  recentDocumentsController.getRecentDocuments(req, res)
);
router.post('/recent-documents', (req, res) =>
  recentDocumentsController.recordAccess(req, res)
);

export default router;
