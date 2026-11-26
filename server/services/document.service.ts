import path from 'path';
import { ApiError } from '../middleware/validate.middleware';
import { DocumentModel } from '../models/document.model';
import { AuthContext, makeSafeId } from '../repositories/base.repository';
import { chunkRepository } from '../repositories/chunk.repository';
import { documentRepository } from '../repositories/document.repository';
import { workspaceRepository } from '../repositories/workspace.repository';
import {
  documentExtractorService,
  DocumentExtractionResult,
} from './document_extractor.service';
import { geminiService } from './gemini.service';
import { ragService } from './rag.service';

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export class DocumentService {
  public async uploadAndProcessFile(
    file: Express.Multer.File,
    customTitle: string | undefined,
    notebookId: string | undefined,
    auth: AuthContext
  ) {
    const resolvedNbId =
      notebookId && notebookId.trim()
        ? notebookId.trim()
        : (await workspaceRepository.ensureDefaultNotebook(auth)).id;

    const docId = makeSafeId('doc');
    const cleanFilename = path.basename(file.originalname || 'document').slice(0, 290);
    const title = (customTitle?.trim() || cleanFilename).slice(0, 290);

    // 1. Validate & extract text/OCR before declaring ready
    let extracted: DocumentExtractionResult;
    try {
      extracted = await documentExtractorService.extractFromFile(file, auth);
    } catch (err: any) {
      // Persist failed document record honestly so user can see error and retry/delete
      const failedDoc: DocumentModel = {
        id: docId,
        userId: auth.userId,
        notebookId: resolvedNbId,
        title,
        originalFilename: cleanFilename,
        type: path.extname(cleanFilename).replace('.', '') || 'text',
        mimeType: file.mimetype || 'application/octet-stream',
        fileSizeBytes: file.size,
        fileSize: formatBytes(file.size),
        processingStatus: 'failed',
        progressPercent: 0,
        chunkCount: 0,
        pageCount: 0,
        errorMessage: err?.message || 'Document extraction failed.',
        content: '',
        summary: '',
        keyConcepts: [],
        addedAt: new Date().toISOString(),
      };
      await documentRepository.save(failedDoc, auth).catch(() => {});
      throw err;
    }

    // 2. Persist original binary file chunks in document_blobs for download & re-indexing
    let storageRef: string | undefined;
    let blobChunkCount = 0;
    try {
      const blobInfo = await documentRepository.saveOriginalFileBlob(
        docId,
        file.buffer,
        extracted.mimeType,
        cleanFilename,
        auth
      );
      storageRef = blobInfo.storageRef;
      blobChunkCount = blobInfo.blobChunkCount;
    } catch {
      // Non-fatal if binary storage exceeds cap; text chunks & content still persist
    }

    // 3. Initial persistent record in extracting/indexing state
    const initialDoc: DocumentModel = {
      id: docId,
      userId: auth.userId,
      notebookId: resolvedNbId,
      title,
      originalFilename: cleanFilename,
      type: extracted.docType,
      mimeType: extracted.mimeType,
      fileSizeBytes: file.size,
      fileSize: formatBytes(file.size),
      storageRef,
      blobChunkCount,
      processingStatus: extracted.usedOcr ? 'ocr_processing' : 'chunking',
      progressPercent: 45,
      chunkCount: 0,
      pageCount: extracted.pageCount,
      ocrWarnings: extracted.ocrWarnings.join(' '),
      content: extracted.fullText,
      summary: '',
      keyConcepts: [],
      addedAt: new Date().toISOString(),
    };
    await documentRepository.save(initialDoc, auth);

    // 4. Chunk + Embed + Summarize
    return this.finalizeIndexingAndSummary(initialDoc, extracted, 0, auth);
  }

  public async processPastedDocument(
    title: string,
    pastedText: string,
    notebookId: string | undefined,
    auth: AuthContext
  ) {
    const resolvedNbId =
      notebookId && notebookId.trim()
        ? notebookId.trim()
        : (await workspaceRepository.ensureDefaultNotebook(auth)).id;

    const extracted = documentExtractorService.extractPlainText(pastedText, 'pasted', 'text/plain');
    const docId = makeSafeId('doc');

    const initialDoc: DocumentModel = {
      id: docId,
      userId: auth.userId,
      notebookId: resolvedNbId,
      title: (title?.trim() || 'Pasted Study Notes').slice(0, 290),
      type: 'pasted',
      mimeType: 'text/plain',
      fileSizeBytes: Buffer.byteLength(pastedText, 'utf-8'),
      fileSize: formatBytes(Buffer.byteLength(pastedText, 'utf-8')),
      processingStatus: 'chunking',
      progressPercent: 45,
      chunkCount: 0,
      pageCount: 1,
      content: extracted.fullText,
      summary: '',
      keyConcepts: [],
      addedAt: new Date().toISOString(),
    };
    await documentRepository.save(initialDoc, auth);

    return this.finalizeIndexingAndSummary(initialDoc, extracted, 0, auth);
  }

  private async finalizeIndexingAndSummary(
    doc: DocumentModel,
    extracted: DocumentExtractionResult,
    previousChunkCount: number,
    auth: AuthContext
  ) {
    try {
      const indexResult = await ragService.indexDocumentUnits(
        doc,
        extracted.units,
        previousChunkCount,
        auth
      );

      let aiResult = {
        summary: 'Document indexed for search and chat.',
        keyConcepts: [] as string[],
        flashcards: [] as Array<{ question: string; answer: string; hint?: string }>,
      };

      const warnings = [...extracted.ocrWarnings];
      if (indexResult.degradedWarning) {
        warnings.push(indexResult.degradedWarning);
      }

      try {
        aiResult = await geminiService.summarizeDocument(doc.title, extracted.fullText, auth);
      } catch (sumErr: any) {
        warnings.push(`Summary generation warning: ${sumErr?.message || 'unavailable'}`);
      }

      const finalStatus =
        warnings.length > 0 ? 'partially_processed' : 'ready';

      const updatedDoc = await documentRepository.patch(
        doc.id,
        {
          processingStatus: finalStatus,
          progressPercent: 100,
          chunkCount: indexResult.chunkCount,
          embeddingModel: indexResult.embeddingModel,
          ocrWarnings: warnings.join(' ').trim(),
          summary: aiResult.summary,
          keyConcepts: aiResult.keyConcepts,
        },
        auth
      );

      await workspaceRepository
        .addActivityLog(
          {
            type: 'source_added',
            title: updatedDoc.title,
            details: `Indexed ${indexResult.chunkCount} chunk(s) across ${updatedDoc.pageCount || 1} page(s) [${finalStatus}]`,
          },
          auth
        )
        .catch(() => {});

      return {
        document: updatedDoc,
        flashcards: aiResult.flashcards,
      };
    } catch (err: any) {
      await documentRepository
        .patch(
          doc.id,
          {
            processingStatus: 'failed',
            progressPercent: 0,
            errorMessage: err?.message || 'Indexing failed',
          },
          auth
        )
        .catch(() => {});
      throw err;
    }
  }

  public async replaceDocumentFile(
    docId: string,
    file: Express.Multer.File,
    auth: AuthContext
  ) {
    const existing = await documentRepository.findById(docId, auth);
    if (!existing) throw new ApiError(404, 'Document not found.', 'NOT_FOUND');

    const extracted = await documentExtractorService.extractFromFile(file, auth);
    await documentRepository.deleteBlobsForDocument(existing, auth);

    const blobInfo = await documentRepository.saveOriginalFileBlob(
      existing.id,
      file.buffer,
      extracted.mimeType,
      path.basename(file.originalname),
      auth
    );

    const patched = await documentRepository.patch(
      existing.id,
      {
        originalFilename: path.basename(file.originalname).slice(0, 290),
        type: extracted.docType,
        mimeType: extracted.mimeType,
        fileSizeBytes: file.size,
        fileSize: formatBytes(file.size),
        storageRef: blobInfo.storageRef,
        blobChunkCount: blobInfo.blobChunkCount,
        pageCount: extracted.pageCount,
        processingStatus: 'indexing',
        progressPercent: 50,
        errorMessage: '',
        ocrWarnings: extracted.ocrWarnings.join(' '),
        content: extracted.fullText,
      },
      auth
    );

    return this.finalizeIndexingAndSummary(patched, extracted, existing.chunkCount || 0, auth);
  }

  public async reindexDocument(docId: string, auth: AuthContext) {
    const existing = await documentRepository.findById(docId, auth);
    if (!existing) throw new ApiError(404, 'Document not found.', 'NOT_FOUND');

    let extracted: DocumentExtractionResult;
    const blob = await documentRepository.getOriginalFileBuffer(existing, auth);
    if (blob && (existing.blobChunkCount || 0) > 0) {
      const syntheticFile = {
        originalname: existing.originalFilename || blob.filename,
        mimetype: blob.mimeType,
        buffer: blob.buffer,
        size: blob.buffer.length,
      } as Express.Multer.File;
      extracted = await documentExtractorService.extractFromFile(syntheticFile, auth);
    } else if (existing.content?.trim()) {
      extracted = documentExtractorService.extractPlainText(
        existing.content,
        (existing.type as any) || 'text',
        existing.mimeType || 'text/plain'
      );
    } else {
      throw new ApiError(400, 'No stored source file or text available to re-index.', 'NO_SOURCE');
    }

    const patched = await documentRepository.patch(
      existing.id,
      {
        processingStatus: 'indexing',
        progressPercent: 50,
        errorMessage: '',
        content: extracted.fullText,
        pageCount: extracted.pageCount,
      },
      auth
    );

    return this.finalizeIndexingAndSummary(patched, extracted, existing.chunkCount || 0, auth);
  }

  public async renameDocument(docId: string, newTitle: string, auth: AuthContext) {
    const existing = await documentRepository.findById(docId, auth);
    if (!existing) throw new ApiError(404, 'Document not found.', 'NOT_FOUND');
    return documentRepository.patch(docId, { title: newTitle.trim().slice(0, 290) }, auth);
  }

  public async getFullDocumentContent(docId: string, auth: AuthContext) {
    const doc = await documentRepository.findById(docId, auth);
    if (!doc) throw new ApiError(404, 'Document not found.', 'NOT_FOUND');

    const chunks = await chunkRepository.getChunksForDocuments([doc], auth);
    const fullText =
      chunks.length > 0 && doc.content.length >= 640000
        ? chunks.map((c) => c.content).join('\n\n')
        : doc.content;

    return {
      document: doc,
      fullText,
      chunks: chunks.map((c) => ({
        id: c.id,
        chunkIndex: c.chunkIndex,
        pageNumber: c.pageNumber,
        slideNumber: c.slideNumber,
        sectionHeading: c.sectionHeading,
        tokenCount: c.tokenCount,
        content: c.content,
      })),
    };
  }

  public async searchInsideDocument(docId: string, query: string, auth: AuthContext) {
    const doc = await documentRepository.findById(docId, auth);
    if (!doc) throw new ApiError(404, 'Document not found.', 'NOT_FOUND');
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const chunks = await chunkRepository.getChunksForDocuments([doc], auth);
    if (chunks.length > 0) {
      return chunks
        .filter((c) => c.content.toLowerCase().includes(q))
        .map((c) => ({
          chunkId: c.id,
          chunkIndex: c.chunkIndex,
          pageNumber: c.pageNumber,
          slideNumber: c.slideNumber,
          sectionHeading: c.sectionHeading,
          excerpt: c.content,
        }));
    }

    // Fallback substring match on raw content
    const idx = doc.content.toLowerCase().indexOf(q);
    if (idx === -1) return [];
    const start = Math.max(0, idx - 160);
    const end = Math.min(doc.content.length, idx + q.length + 240);
    return [
      {
        chunkId: 'fulltext-0',
        chunkIndex: 0,
        pageNumber: 1,
        sectionHeading: 'Document Match',
        excerpt: doc.content.slice(start, end),
      },
    ];
  }

  public async downloadOriginalDocument(docId: string, auth: AuthContext) {
    const doc = await documentRepository.findById(docId, auth);
    if (!doc) throw new ApiError(404, 'Document not found.', 'NOT_FOUND');
    const file = await documentRepository.getOriginalFileBuffer(doc, auth);
    if (!file) throw new ApiError(404, 'Stored document file not found.', 'NOT_FOUND');
    return file;
  }

  public async getDocument(id: string, auth: AuthContext) {
    return documentRepository.findById(id, auth);
  }

  public async getAllDocuments(auth: AuthContext, notebookId?: string) {
    return documentRepository.findAll(auth, notebookId);
  }

  public async deleteDocument(id: string, auth: AuthContext) {
    const existing = await documentRepository.findById(id, auth);
    if (!existing) return false;
    await chunkRepository.deleteChunksForDocument(existing, auth);
    return documentRepository.delete(id, auth);
  }
}

export const documentService = new DocumentService();
