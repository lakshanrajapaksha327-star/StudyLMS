import { Request, Response } from 'express';
import { recentDocumentRepository } from '../repositories/recent_document.repository';

export class RecentDocumentsController {
  public async getRecentDocuments(req: Request, res: Response) {
    try {
      const userId = (req.query.userId as string) || '1';
      const items = await recentDocumentRepository.getRecentDocuments(userId);
      res.json({ success: true, items });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to retrieve recent documents' });
    }
  }

  public async recordAccess(req: Request, res: Response) {
    try {
      const { userId = '1', documentId, documentTitle, documentType = 'pdf' } = req.body;
      if (!documentId || !documentTitle) {
        return res.status(400).json({ error: 'documentId and documentTitle required' });
      }
      const entry = await recentDocumentRepository.recordAccess(
        userId,
        documentId,
        documentTitle,
        documentType
      );
      res.json({ success: true, entry });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to record document access' });
    }
  }
}

export const recentDocumentsController = new RecentDocumentsController();
