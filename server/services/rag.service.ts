import { aiManagerService } from '../ai/ai-manager.service';
import { modelRegistry } from '../ai/model-registry';
import { DocumentChunkModel, DocumentCitation, DocumentModel } from '../models/document.model';
import { AuthContext } from '../repositories/base.repository';
import { chunkRepository } from '../repositories/chunk.repository';
import { documentRepository } from '../repositories/document.repository';
import { chunkingService, estimateTokens } from './chunking.service';
import { ExtractedUnit } from './document_extractor.service';

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

function tokenizeKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'is', 'at', 'which', 'on', 'and', 'or', 'for', 'to', 'of', 'in', 'a', 'an',
    'what', 'why', 'how', 'when', 'where', 'who', 'can', 'you', 'me', 'my', 'from',
    'about', 'with', 'this', 'that', 'these', 'those', 'explain', 'summarize', 'are',
  ]);
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));
}

function lexicalScore(queryTokens: string[], content: string, heading?: string): number {
  if (queryTokens.length === 0) return 0;
  const hay = `${heading || ''} ${content}`.toLowerCase();
  let hits = 0;
  for (const tok of queryTokens) {
    if (hay.includes(tok)) hits++;
  }
  return hits / queryTokens.length;
}

export interface RetrieveContextOptions {
  query: string;
  auth: AuthContext;
  notebookId?: string;
  selectedDocumentIds?: string[];
  topK?: number;
  maxContextTokens?: number;
  minScore?: number;
}

export interface RetrieveContextResult {
  citations: DocumentCitation[];
  formattedContext: string;
  hasEvidence: boolean;
  searchedDocumentCount: number;
}

export class RagService {
  /**
   * Chunk, embed with gemini-embedding-2, and persist vector chunks for a document
   */
  public async indexDocumentUnits(
    doc: DocumentModel,
    units: ExtractedUnit[],
    previousChunkCount: number,
    auth: AuthContext
  ): Promise<{ chunkCount: number; embeddingModel: string; degradedWarning?: string }> {
    const chunks = chunkingService.buildChunks(units, {
      documentId: doc.id,
      userId: auth.userId,
      notebookId: doc.notebookId,
      sourceTitle: doc.title,
    });

    if (chunks.length === 0) {
      throw new Error('No indexable text chunks could be created from document.');
    }

    let embeddingModel = modelRegistry.resolveModelForProvider('gemini', 'embeddings');
    let degradedWarning: string | undefined;

    try {
      const { vectors, model } = await aiManagerService.embedTexts(
        chunks.map((c) => c.content),
        'RETRIEVAL_DOCUMENT'
      );
      embeddingModel = model;
      chunks.forEach((chunk, idx) => {
        chunk.embedding = vectors[idx];
        chunk.embeddingModel = model;
      });
    } catch (err: any) {
      degradedWarning = `Vector embedding partially unavailable (${err?.message || 'embedding error'}); lexical search fallback indexed.`;
      embeddingModel = 'lexical-fallback';
      chunks.forEach((chunk) => {
        chunk.embeddingModel = 'lexical-fallback';
      });
    }

    await chunkRepository.replaceDocumentChunks(doc, previousChunkCount, chunks, auth);

    return {
      chunkCount: chunks.length,
      embeddingModel,
      degradedWarning,
    };
  }

  /**
   * Hybrid vector + lexical retrieval across user-owned documents
   */
  public async retrieveContext(opts: RetrieveContextOptions): Promise<RetrieveContextResult> {
    const allDocs = await documentRepository.findAll(opts.auth, opts.notebookId);
    const readyDocs = allDocs.filter(
      (d) => d.processingStatus !== 'failed' && (d.chunkCount || 0) > 0
    );

    const targetDocs =
      opts.selectedDocumentIds && opts.selectedDocumentIds.length > 0
        ? readyDocs.filter((d) => opts.selectedDocumentIds!.includes(d.id))
        : readyDocs;

    if (targetDocs.length === 0) {
      return {
        citations: [],
        formattedContext: '',
        hasEvidence: false,
        searchedDocumentCount: 0,
      };
    }

    const chunks = await chunkRepository.getChunksForDocuments(targetDocs, opts.auth);
    if (chunks.length === 0) {
      return {
        citations: [],
        formattedContext: '',
        hasEvidence: false,
        searchedDocumentCount: targetDocs.length,
      };
    }

    let queryVector: number[] | null = null;
    try {
      const emb = await aiManagerService.embedTexts([opts.query], 'RETRIEVAL_QUERY');
      queryVector = emb.vectors[0] || null;
    } catch {
      queryVector = null;
    }

    const queryTokens = tokenizeKeywords(opts.query);
    const docMap = new Map(targetDocs.map((d) => [d.id, d]));

    const scored = chunks.map((chunk) => {
      const lex = lexicalScore(queryTokens, chunk.content, chunk.sectionHeading);
      const vec =
        queryVector && chunk.embedding && chunk.embedding.length === queryVector.length
          ? Math.max(0, cosineSimilarity(queryVector, chunk.embedding))
          : 0;
      const score = queryVector && chunk.embedding ? vec * 0.72 + lex * 0.28 : lex;
      return { chunk, score, vec, lex };
    });

    scored.sort((a, b) => b.score - a.score);

    const minScore = opts.minScore ?? (queryVector ? 0.28 : 0.15);
    const topK = opts.topK ?? 10;
    const maxTokens = opts.maxContextTokens ?? 6000;

    // Deduplicate identical chunk hashes and diversify across documents when searching multiple sources
    const seenHashes = new Set<string>();
    const perDocCounts = new Map<string, number>();
    const maxPerDoc = targetDocs.length > 1 ? Math.max(2, Math.ceil(topK / targetDocs.length) + 1) : topK;

    const chosen: Array<{ chunk: DocumentChunkModel; score: number }> = [];
    let runningTokens = 0;

    for (const item of scored) {
      if (item.score < minScore && chosen.length > 0) break;
      if (item.score < minScore && chosen.length === 0) continue;

      if (item.chunk.contentHash && seenHashes.has(item.chunk.contentHash)) continue;
      const docCount = perDocCounts.get(item.chunk.documentId) || 0;
      if (docCount >= maxPerDoc && scored.some((s) => (perDocCounts.get(s.chunk.documentId) || 0) === 0 && s.score >= minScore)) {
        continue;
      }

      const tok = item.chunk.tokenCount || estimateTokens(item.chunk.content);
      if (runningTokens + tok > maxTokens && chosen.length > 0) break;

      chosen.push({ chunk: item.chunk, score: item.score });
      runningTokens += tok;
      perDocCounts.set(item.chunk.documentId, docCount + 1);
      if (item.chunk.contentHash) seenHashes.add(item.chunk.contentHash);
      if (chosen.length >= topK) break;
    }

    if (chosen.length === 0) {
      return {
        citations: [],
        formattedContext: '',
        hasEvidence: false,
        searchedDocumentCount: targetDocs.length,
      };
    }

    const citations: DocumentCitation[] = chosen.map(({ chunk, score }) => {
      const parentDoc = docMap.get(chunk.documentId);
      const docTitle = chunk.sourceTitle || parentDoc?.title || 'Source Document';
      return {
        documentId: chunk.documentId,
        documentTitle: docTitle,
        chunkId: chunk.id,
        chunkIndex: chunk.chunkIndex,
        pageNumber: chunk.pageNumber,
        slideNumber: chunk.slideNumber,
        sectionHeading: chunk.sectionHeading,
        excerpt: chunk.content.slice(0, 320),
        score: Number(score.toFixed(3)),
      };
    });

    const formattedContext = chosen
      .map(({ chunk }) => {
        const parentDoc = docMap.get(chunk.documentId);
        const docTitle = (chunk.sourceTitle || parentDoc?.title || 'Source Document').replace(/["<>]/g, '');
        const locParts = [
          `Source: "${docTitle}"`,
          chunk.pageNumber ? `Page ${chunk.pageNumber}` : undefined,
          chunk.slideNumber ? `Slide ${chunk.slideNumber}` : undefined,
          chunk.sectionHeading ? `Section: ${chunk.sectionHeading.replace(/[<>]/g, '')}` : undefined,
        ]
          .filter(Boolean)
          .join(' | ');
        const safeContent = chunk.content.replace(/<\/?untrusted_study_source[^>]*>/gi, '');
        return `<untrusted_study_source location="${locParts}">\n[${locParts}]\n${safeContent}\n</untrusted_study_source>`;
      })
      .join('\n\n---\n\n');

    return {
      citations,
      formattedContext,
      hasEvidence: true,
      searchedDocumentCount: targetDocs.length,
    };
  }
}

export const ragService = new RagService();
