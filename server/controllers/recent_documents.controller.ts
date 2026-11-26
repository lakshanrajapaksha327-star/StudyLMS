import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../middleware/validate.middleware';
import { getAuthContext } from '../repositories/base.repository';
import { recentDocumentRepository } from '../repositories/recent_document.repository';

export class RecentDocumentsController {
  public async getRecentDocuments(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const items = await recentDocumentRepository.getRecentDocuments(auth);
      res.json({ success: true, items });
    } catch (err) {
      next(err);
    }
  }

  public async recordAccess(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { documentId, documentTitle, documentType = 'pdf' } = req.body;
      if (!documentId || !documentTitle) {
        throw new ApiError(400, 'documentId and documentTitle are required.');
      }
      const entry = await recentDocumentRepository.recordAccess(
        String(documentId),
        String(documentTitle),
        String(documentType),
        auth
      );
      res.json({ success: true, entry });
    } catch (err) {
      next(err);
    }
  }
}

export const recentDocumentsController = new RecentDocumentsController();
