export interface RecentDocumentModel {
  id: string;
  userId: string;
  documentId: string;
  documentTitle: string;
  documentType: 'pdf' | 'text' | 'markdown' | 'pasted';
  openedAt: string;
}
