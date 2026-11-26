import { firestoreRest } from '../config/firestore_rest';
import { RecentDocumentModel } from '../models/recent_document.model';
import { AuthContext, pickAllowedKeys } from './base.repository';

const RECENT_DOC_KEYS = [
  'id',
  'userId',
  'documentId',
  'documentTitle',
  'documentType',
  'openedAt',
] as const;

export class RecentDocumentRepository {
  public async recordAccess(
    documentId: string,
    documentTitle: string,
    documentType: string,
    auth: AuthContext
  ): Promise<RecentDocumentModel> {
    const safeDocId = documentId.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 64);
    const id = `rec-${auth.userId.slice(0, 16)}-${safeDocId}`;
    const entry: RecentDocumentModel = {
      id,
      userId: auth.userId,
      documentId: safeDocId,
      documentTitle: documentTitle.slice(0, 290),
      documentType: (documentType || 'pdf') as any,
      openedAt: new Date().toISOString(),
    };
    const clean = pickAllowedKeys(entry, RECENT_DOC_KEYS) as RecentDocumentModel;
    return firestoreRest.setDoc('recent_documents', clean.id, clean, auth.idToken);
  }

  public async getRecentDocuments(auth: AuthContext, limit = 12): Promise<RecentDocumentModel[]> {
    const list = await firestoreRest.listByUser<RecentDocumentModel>(
      'recent_documents',
      auth.userId,
      auth.idToken
    );
    return list
      .sort((a, b) => (b.openedAt || '').localeCompare(a.openedAt || ''))
      .slice(0, limit);
  }
}

export const recentDocumentRepository = new RecentDocumentRepository();
