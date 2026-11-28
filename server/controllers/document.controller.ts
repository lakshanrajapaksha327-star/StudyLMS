import { Request, Response, NextFunction } from 'express';
import { ApiError, isValidResourceId } from '../middleware/validate.middleware';
import { getAuthContext } from '../repositories/base.repository';
import { documentService } from '../services/document.service';
import { ragService } from '../services/rag.service';

export class DocumentController {
  public async uploadAndSummarize(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const customTitle = typeof req.body.title === 'string' ? req.body.title.trim() : undefined;
      const notebookId = typeof req.body.notebookId === 'string' ? req.body.notebookId.trim() : undefined;
      const pastedText = typeof req.body.pastedText === 'string' ? req.body.pastedText : '';

      if (req.file) {
        const result = await documentService.uploadAndProcessFile(
          req.file,
          customTitle,
          notebookId,
          auth
        );
        return res.json({
          success: true,
          document: result.document,
          flashcards: result.flashcards,
          job: result.job,
        });
      }

      if (pastedText.trim()) {
        const result = await documentService.processPastedDocument(
          customTitle || 'Pasted Study Text',
          pastedText,
          notebookId,
          auth
        );
        return res.json({
          success: true,
          document: result.document,
          flashcards: result.flashcards,
          job: result.job,
        });
      }

      throw new ApiError(400, 'Please attach a supported file or provide study text.', 'NO_INPUT');
    } catch (err) {
      next(err);
    }
  }

  public async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const notebookId = typeof req.query.notebookId === 'string' ? req.query.notebookId : undefined;
      const q = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));

      let documents = await documentService.getAllDocuments(auth, notebookId);
      if (q) {
        documents = documents.filter(
          (d) =>
            d.title.toLowerCase().includes(q) ||
            (d.summary || '').toLowerCase().includes(q) ||
            (d.keyConcepts || []).some((k) => k.toLowerCase().includes(q))
        );
      }

      const total = documents.length;
      const sliced = documents.slice((page - 1) * limit, page * limit);
      res.json({ success: true, documents: sliced, total, page, limit });
    } catch (err) {
      next(err);
    }
  }

  public async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      if (!isValidResourceId(req.params.id)) throw new ApiError(400, 'Invalid document ID.');
      const doc = await documentService.getDocument(req.params.id, auth);
      if (!doc) throw new ApiError(404, 'Document not found.', 'NOT_FOUND');
      res.json({ success: true, document: doc });
    } catch (err) {
      next(err);
    }
  }

  public async getFullContent(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      if (!isValidResourceId(req.params.id)) throw new ApiError(400, 'Invalid document ID.');
      const result = await documentService.getFullDocumentContent(req.params.id, auth);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  public async searchInside(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      if (!isValidResourceId(req.params.id)) throw new ApiError(400, 'Invalid document ID.');
      const q = typeof req.query.q === 'string' ? req.query.q : '';
      const matches = await documentService.searchInsideDocument(req.params.id, q, auth);
      res.json({ success: true, matches });
    } catch (err) {
      next(err);
    }
  }

  public async downloadOriginal(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      if (!isValidResourceId(req.params.id)) throw new ApiError(400, 'Invalid document ID.');
      const file = await documentService.downloadOriginalDocument(req.params.id, auth);
      const safeName = file.filename.replace(/["\r\n]/g, '_');
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
      res.send(file.buffer);
    } catch (err) {
      next(err);
    }
  }

  public async rename(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      if (!isValidResourceId(req.params.id)) throw new ApiError(400, 'Invalid document ID.');
      const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
      if (!title) throw new ApiError(400, 'Title is required.');
      const updated = await documentService.renameDocument(req.params.id, title, auth);
      res.json({ success: true, document: updated });
    } catch (err) {
      next(err);
    }
  }

  public async replaceFile(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      if (!isValidResourceId(req.params.id)) throw new ApiError(400, 'Invalid document ID.');
      if (!req.file) throw new ApiError(400, 'Replacement file is required.');
      const result = await documentService.replaceDocumentFile(req.params.id, req.file, auth);
      res.json({
        success: true,
        document: result.document,
        flashcards: result.flashcards,
        job: result.job,
      });
    } catch (err) {
      next(err);
    }
  }

  public async reindex(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      if (!isValidResourceId(req.params.id)) throw new ApiError(400, 'Invalid document ID.');
      const result = await documentService.reindexDocument(req.params.id, auth);
      res.json({
        success: true,
        document: result.document,
        flashcards: result.flashcards,
        job: result.job,
      });
    } catch (err) {
      next(err);
    }
  }

  public async getJob(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      if (!isValidResourceId(req.params.id)) throw new ApiError(400, 'Invalid document ID.');
      const job = await documentService.getDocumentJob(req.params.id, auth);
      if (!job) throw new ApiError(404, 'Document job not found.', 'NOT_FOUND');
      res.json({ success: true, job });
    } catch (err) {
      next(err);
    }
  }

  public async listJobs(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const jobs = await documentService.listDocumentJobs(auth);
      res.json({ success: true, jobs });
    } catch (err) {
      next(err);
    }
  }

  public async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      if (!isValidResourceId(req.params.id)) throw new ApiError(400, 'Invalid document ID.');
      const success = await documentService.deleteDocument(req.params.id, auth);
      if (!success) throw new ApiError(404, 'Document not found.', 'NOT_FOUND');
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  public async retrieveRag(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { query, notebookId, selectedDocumentIds, topK } = req.body || {};
      if (!query || typeof query !== 'string' || !query.trim()) {
        throw new ApiError(400, 'Search query is required.');
      }
      const result = await ragService.retrieveContext({
        query: query.trim(),
        auth,
        notebookId,
        selectedDocumentIds,
        topK: Number(topK) || 8,
      });
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
}

export const documentController = new DocumentController();
