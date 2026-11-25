import { Router } from 'express';
import multer from 'multer';
import { documentController } from '../controllers/document.controller';

const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

const router = Router();

router.post('/upload-document', upload.single('file'), (req, res) =>
  documentController.uploadAndSummarize(req, res)
);

router.get('/documents', (req, res) => documentController.getAll(req, res));
router.get('/documents/:id', (req, res) => documentController.getById(req, res));
router.delete('/documents/:id', (req, res) => documentController.delete(req, res));

export default router;
