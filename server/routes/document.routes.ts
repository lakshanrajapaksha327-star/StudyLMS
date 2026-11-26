import { Router } from 'express';
import multer from 'multer';
import { documentController } from '../controllers/document.controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const router = Router();

router.post('/upload-document', upload.single('file'), (req, res, next) =>
  documentController.uploadAndSummarize(req, res, next)
);
router.post('/rag/retrieve', (req, res, next) =>
  documentController.retrieveRag(req, res, next)
);

router.get('/documents', (req, res, next) => documentController.getAll(req, res, next));
router.get('/documents/:id', (req, res, next) => documentController.getById(req, res, next));
router.get('/documents/:id/content', (req, res, next) =>
  documentController.getFullContent(req, res, next)
);
router.get('/documents/:id/search', (req, res, next) =>
  documentController.searchInside(req, res, next)
);
router.get('/documents/:id/download', (req, res, next) =>
  documentController.downloadOriginal(req, res, next)
);
router.patch('/documents/:id', (req, res, next) => documentController.rename(req, res, next));
router.put('/documents/:id/file', upload.single('file'), (req, res, next) =>
  documentController.replaceFile(req, res, next)
);
router.post('/documents/:id/retry', (req, res, next) =>
  documentController.reindex(req, res, next)
);
router.post('/documents/:id/reindex', (req, res, next) =>
  documentController.reindex(req, res, next)
);
router.delete('/documents/:id', (req, res, next) => documentController.delete(req, res, next));

export default router;
