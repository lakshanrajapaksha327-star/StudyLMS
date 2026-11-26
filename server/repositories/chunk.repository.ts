import { firestoreRest } from '../config/firestore_rest';
import { DocumentChunkModel, DocumentModel } from '../models/document.model';
import { AuthContext, pickAllowedKeys } from './base.repository';

const CHUNK_ALLOWED_KEYS = [
  'id',
  'userId',
  'notebookId',
  'documentId',
  'chunkIndex',
  'content',
  'contentHash',
  'pageNumber',
  'slideNumber',
  'sectionHeading',
  'sourceTitle',
  'tokenCount',
  'embedding',
  'embeddingModel',
  'createdAt',
] as const;

export class ChunkRepository {
  public async replaceDocumentChunks(
    doc: DocumentModel,
    previousChunkCount: number,
    chunks: DocumentChunkModel[],
    auth: AuthContext
  ): Promise<void> {
    // Delete any stale chunks beyond new chunk count
    if (previousChunkCount > chunks.length) {
      for (let i = chunks.length; i < previousChunkCount; i++) {
        await firestoreRest
          .deleteDoc('document_chunks', `chunk-${doc.id}-${i}`, auth.idToken)
          .catch(() => {});
      }
    }

    // Write chunks deterministically as chunk-{docId}-{idx}
    for (const chunk of chunks) {
      const safeChunk: DocumentChunkModel = {
        ...chunk,
        userId: auth.userId,
        notebookId: doc.notebookId,
        documentId: doc.id,
        id: `chunk-${doc.id}-${chunk.chunkIndex}`,
        content: chunk.content.slice(0, 19500),
      };
      const clean = pickAllowedKeys(safeChunk, CHUNK_ALLOWED_KEYS) as DocumentChunkModel;
      await firestoreRest.setDoc('document_chunks', clean.id, clean, auth.idToken);
    }
  }

  public async getChunksForDocuments(
    docs: DocumentModel[],
    auth: AuthContext
  ): Promise<DocumentChunkModel[]> {
    const ids: string[] = [];
    for (const d of docs) {
      const count = d.chunkCount || 0;
      for (let i = 0; i < count; i++) {
        ids.push(`chunk-${d.id}-${i}`);
      }
    }
    if (ids.length === 0) return [];
    const chunks = await firestoreRest.batchGetDocs<DocumentChunkModel>(
      'document_chunks',
      ids,
      auth.idToken
    );
    return chunks
      .filter((c) => c.userId === auth.userId)
      .sort((a, b) => a.chunkIndex - b.chunkIndex);
  }

  public async deleteChunksForDocument(doc: DocumentModel, auth: AuthContext): Promise<void> {
    const count = doc.chunkCount || 0;
    for (let i = 0; i < count; i++) {
      await firestoreRest
        .deleteDoc('document_chunks', `chunk-${doc.id}-${i}`, auth.idToken)
        .catch(() => {});
    }
  }
}

export const chunkRepository = new ChunkRepository();
