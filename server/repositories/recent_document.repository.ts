import { RecentDocumentModel } from '../models/recent_document.model';

class RecentDocumentRepository {
  private items: RecentDocumentModel[] = [];

  public async recordAccess(
    userId: string,
    documentId: string,
    documentTitle: string,
    documentType: 'pdf' | 'text' | 'markdown' | 'pasted'
  ): Promise<RecentDocumentModel> {
    // Remove duplicate entry if exists to move to top
    this.items = this.items.filter((item) => item.documentId !== documentId || item.userId !== userId);

    const entry: RecentDocumentModel = {
      id: `recent-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      userId,
      documentId,
      documentTitle,
      documentType,
      openedAt: new Date().toISOString(),
    };

    this.items.unshift(entry);
    return entry;
  }

  public async getRecentDocuments(userId: string, limit = 10): Promise<RecentDocumentModel[]> {
    return this.items.filter((item) => item.userId === userId || !item.userId).slice(0, limit);
  }
}

export const recentDocumentRepository = new RecentDocumentRepository();
