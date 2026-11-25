import { Request, Response } from 'express';
import path from 'path';
import { documentService } from '../services/document.service';

export class DocumentController {
  public async uploadAndSummarize(req: Request, res: Response) {
    try {
      let textContent = req.body.pastedText || '';
      let docTitle = req.body.title || 'Uploaded Document';
      let docType: 'pdf' | 'text' | 'markdown' | 'pasted' = 'text';

      if (req.file) {
        docTitle = req.file.originalname;
        const fileExt = path.extname(req.file.originalname).toLowerCase();
        if (fileExt === '.md') docType = 'markdown';
        else if (fileExt === '.pdf') docType = 'pdf';
        else docType = 'text';

        textContent = req.file.buffer.toString('utf-8');
      } else if (req.body.pastedText) {
        docType = 'pasted';
      }

      if (!textContent.trim()) {
        return res.status(400).json({ error: 'No document content or text provided.' });
      }

      const result = await documentService.processAndSaveDocument(
        docTitle,
        textContent,
        docType,
        req.body.notebookId
      );

      res.json({
        success: true,
        document: result.document,
        flashcards: result.flashcards,
      });
    } catch (error: any) {
      console.error('DocumentController Error:', error);
      res.status(500).json({
        error: 'Failed to upload and summarize document with Gemini',
        details: error?.message || String(error),
      });
    }
  }

  public async getAll(req: Request, res: Response) {
    try {
      const documents = await documentService.getAllDocuments();
      res.json({ success: true, documents });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to retrieve documents.' });
    }
  }

  public async getById(req: Request, res: Response) {
    try {
      const doc = await documentService.getDocument(req.params.id);
      if (!doc) return res.status(404).json({ error: 'Document not found.' });
      res.json({ success: true, document: doc });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to retrieve document.' });
    }
  }

  public async delete(req: Request, res: Response) {
    try {
      const success = await documentService.deleteDocument(req.params.id);
      res.json({ success });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to delete document.' });
    }
  }
}

export const documentController = new DocumentController();
