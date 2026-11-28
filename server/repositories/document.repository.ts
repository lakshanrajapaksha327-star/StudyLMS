import { firestoreRest } from '../config/firestore_rest';
import { DocumentBlobModel, DocumentJobModel, DocumentModel } from '../models/document.model';
import { AuthContext, pickAllowedKeys } from './base.repository';

const DOCUMENT_ALLOWED_KEYS = [
  'id',
  'userId',
  'notebookId',
  'title',
  'originalFilename',
  'type',
  'mimeType',
  'fileSizeBytes',
  'fileSize',
  'storageRef',
  'blobChunkCount',
  'processingStatus',
  'progressPercent',
  'chunkCount',
  'pageCount',
  'embeddingProvider',
  'embeddingModel',
  'ocrWarnings',
  'errorMessage',
  'content',
  'summary',
  'keyConcepts',
  'addedAt',
  'updatedAt',
] as const;

const BLOB_ALLOWED_KEYS = [
  'id',
  'userId',
  'documentId',
  'chunkIndex',
  'totalChunks',
  'mimeType',
  'originalFilename',
  'dataBase64',
  'createdAt',
] as const;

const JOB_ALLOWED_KEYS = [
  'id',
  'userId',
  'documentId',
  'notebookId',
  'stage',
  'progressPercent',
  'retryCount',
  'stepHistory',
  'errorMessage',
  'startedAt',
  'updatedAt',
  'completedAt',
] as const;

export class DocumentRepository {
  public async save(doc: DocumentModel, auth: AuthContext): Promise<DocumentModel> {
    const payload: DocumentModel = {
      ...doc,
      userId: auth.userId,
      notebookId: (doc.notebookId || 'nb-default').replace(/[^a-zA-Z0-9_\-]/g, '-'),
      content: (doc.content || '').slice(0, 650000),
      summary: (doc.summary || '').slice(0, 19000),
      ocrWarnings: doc.ocrWarnings ? doc.ocrWarnings.slice(0, 1900) : undefined,
      errorMessage: doc.errorMessage ? doc.errorMessage.slice(0, 950) : undefined,
      keyConcepts: Array.isArray(doc.keyConcepts) ? doc.keyConcepts.slice(0, 50) : [],
      updatedAt: new Date().toISOString(),
    };
    const clean = pickAllowedKeys(payload, DOCUMENT_ALLOWED_KEYS) as DocumentModel;
    return firestoreRest.setDoc<DocumentModel>('documents', clean.id, clean, auth.idToken);
  }

  public async patch(
    id: string,
    updates: Partial<DocumentModel>,
    auth: AuthContext
  ): Promise<DocumentModel> {
    const safeUpdates: Record<string, any> = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    delete safeUpdates.id;
    delete safeUpdates.userId;
    delete safeUpdates.addedAt;
    if (typeof safeUpdates.content === 'string') {
      safeUpdates.content = safeUpdates.content.slice(0, 650000);
    }
    if (typeof safeUpdates.summary === 'string') {
      safeUpdates.summary = safeUpdates.summary.slice(0, 19000);
    }
    if (typeof safeUpdates.ocrWarnings === 'string') {
      safeUpdates.ocrWarnings = safeUpdates.ocrWarnings.slice(0, 1900);
    }
    if (typeof safeUpdates.errorMessage === 'string') {
      safeUpdates.errorMessage = safeUpdates.errorMessage.slice(0, 950);
    }
    const clean = pickAllowedKeys(safeUpdates, DOCUMENT_ALLOWED_KEYS);
    return firestoreRest.patchDoc<DocumentModel>('documents', id, clean, auth.idToken);
  }

  public async findById(id: string, auth: AuthContext): Promise<DocumentModel | undefined> {
    const doc = await firestoreRest.getDoc<DocumentModel>('documents', id, auth.idToken);
    if (!doc || doc.userId !== auth.userId) return undefined;
    return doc;
  }

  public async findAll(auth: AuthContext, notebookId?: string): Promise<DocumentModel[]> {
    const docs = await firestoreRest.listByUser<DocumentModel>('documents', auth.userId, auth.idToken);
    const filtered = notebookId ? docs.filter((d) => d.notebookId === notebookId) : docs;
    return filtered.sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''));
  }

  public async delete(id: string, auth: AuthContext): Promise<boolean> {
    const doc = await this.findById(id, auth);
    if (!doc) return false;
    await this.deleteBlobsForDocument(doc, auth);
    return firestoreRest.deleteDoc('documents', id, auth.idToken);
  }

  public async saveOriginalFileBlob(
    documentId: string,
    buffer: Buffer,
    mimeType: string,
    originalFilename: string,
    auth: AuthContext
  ): Promise<{ blobChunkCount: number; storageRef: string }> {
    const base64 = buffer.toString('base64');
    // Keep each base64 chunk well below the 850,000 char rule cap & 1MB Firestore limit
    const chunkSize = 700000;
    const totalChunks = Math.max(1, Math.ceil(base64.length / chunkSize));
    const now = new Date().toISOString();

    for (let i = 0; i < totalChunks; i++) {
      const slice = base64.slice(i * chunkSize, (i + 1) * chunkSize);
      const blobId = `blob-${documentId}-${i}`;
      const blob: DocumentBlobModel = {
        id: blobId,
        userId: auth.userId,
        documentId,
        chunkIndex: i,
        totalChunks,
        mimeType,
        originalFilename: originalFilename.slice(0, 290),
        dataBase64: slice,
        createdAt: now,
      };
      const clean = pickAllowedKeys(blob, BLOB_ALLOWED_KEYS) as DocumentBlobModel;
      await firestoreRest.setDoc('document_blobs', blobId, clean, auth.idToken);
    }

    return {
      blobChunkCount: totalChunks,
      storageRef: `firestore:document_blobs:${documentId}`,
    };
  }

  public async getOriginalFileBuffer(
    doc: DocumentModel,
    auth: AuthContext
  ): Promise<{ buffer: Buffer; mimeType: string; filename: string } | null> {
    const count = doc.blobChunkCount || 0;
    if (count > 0) {
      const ids = Array.from({ length: count }, (_, idx) => `blob-${doc.id}-${idx}`);
      const blobs = await firestoreRest.batchGetDocs<DocumentBlobModel>(
        'document_blobs',
        ids,
        auth.idToken
      );
      if (blobs.length === 0) return null;
      blobs.sort((a, b) => a.chunkIndex - b.chunkIndex);
      const combined = blobs.map((b) => b.dataBase64).join('');
      return {
        buffer: Buffer.from(combined, 'base64'),
        mimeType: doc.mimeType || blobs[0].mimeType || 'application/octet-stream',
        filename: doc.originalFilename || blobs[0].originalFilename || `${doc.title}.txt`,
      };
    }

    // Fallback to extracted text if document was pasted/created without binary file
    if (doc.content) {
      return {
        buffer: Buffer.from(doc.content, 'utf-8'),
        mimeType: 'text/plain; charset=utf-8',
        filename: `${doc.title.replace(/[^a-zA-Z0-9_\- ]/g, '_')}.txt`,
      };
    }

    return null;
  }

  public async deleteBlobsForDocument(doc: DocumentModel, auth: AuthContext): Promise<void> {
    const count = doc.blobChunkCount || 0;
    if (count <= 0) return;
    for (let i = 0; i < count; i++) {
      await firestoreRest.deleteDoc('document_blobs', `blob-${doc.id}-${i}`, auth.idToken).catch(() => {});
    }
  }

  public async saveJob(job: DocumentJobModel, auth: AuthContext): Promise<DocumentJobModel> {
    const payload: DocumentJobModel = {
      ...job,
      id: `job-${job.documentId}`,
      userId: auth.userId,
      errorMessage: job.errorMessage ? job.errorMessage.slice(0, 950) : undefined,
      stepHistory: Array.isArray(job.stepHistory) ? job.stepHistory.slice(-25) : [],
      updatedAt: new Date().toISOString(),
    };
    const clean = pickAllowedKeys(payload, JOB_ALLOWED_KEYS) as DocumentJobModel;
    return firestoreRest.setDoc<DocumentJobModel>('document_jobs', clean.id, clean, auth.idToken);
  }

  public async getJobByDocumentId(
    documentId: string,
    auth: AuthContext
  ): Promise<DocumentJobModel | undefined> {
    const job = await firestoreRest.getDoc<DocumentJobModel>(
      'document_jobs',
      `job-${documentId}`,
      auth.idToken
    );
    if (!job || job.userId !== auth.userId) return undefined;
    return job;
  }

  public async listJobsByUser(auth: AuthContext): Promise<DocumentJobModel[]> {
    const jobs = await firestoreRest.listByUser<DocumentJobModel>(
      'document_jobs',
      auth.userId,
      auth.idToken
    );
    return jobs.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }

  public async deleteJobForDocument(documentId: string, auth: AuthContext): Promise<void> {
    await firestoreRest
      .deleteDoc('document_jobs', `job-${documentId}`, auth.idToken)
      .catch(() => {});
  }
}

export const documentRepository = new DocumentRepository();
