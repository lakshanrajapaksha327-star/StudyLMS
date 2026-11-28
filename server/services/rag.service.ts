import { aiManagerService } from '../ai/ai-manager.service';
import { modelRegistry } from '../ai/model-registry';
import { DocumentChunkModel, DocumentCitation, DocumentModel } from '../models/document.model';
import { AuthContext } from '../repositories/base.repository';
import { chunkRepository } from '../repositories/chunk.repository';
import { documentRepository } from '../repositories/document.repository';
import { chunkingService, estimateTokens } from './chunking.service';
import { ExtractedUnit } from './document_extractor.service';

export function cosineSimilarity(a: number[], b: number[]): number {
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

/**
 * Unicode-aware tokenizer supporting English, Sinhala (\u0D80-\u0DFF), Tamil (\u0B80-\u0BFF),
 * numerals, combining marks, and technical hyphenated/underscored identifiers.
 */
export function tokenizeKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'is', 'at', 'which', 'on', 'and', 'or', 'for', 'to', 'of', 'in', 'a', 'an',
    'what', 'why', 'how', 'when', 'where', 'who', 'can', 'you', 'me', 'my', 'from',
    'about', 'with', 'this', 'that', 'these', 'those', 'explain', 'summarize', 'are',
  ]);

  const rawTokens = text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s\-_]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const tokens: string[] = [];
  for (const tok of rawTokens) {
    const clean = tok.replace(/^[\-_]+|[\-_]+$/g, '');
    if (!clean) continue;
    const isIndic = /[\u0B80-\u0BFF\u0D80-\u0DFF]/.test(clean);
    if (isIndic) {
      if (clean.length >= 2) tokens.push(clean);
    } else if (clean.length > 2 && !stopWords.has(clean)) {
      tokens.push(clean);
    }
  }
  return Array.from(new Set(tokens));
}

function lexicalScore(queryTokens: string[], content: string, heading?: string): number {
  if (queryTokens.length === 0) return 0;
  const hay = `${heading || ''} ${content}`.normalize('NFC').toLowerCase();
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
  needsReindexDocumentIds: string[];
  embeddingProviderUsed: 'gemini' | 'openai' | 'lexical-fallback';
  embeddingModelUsed: string;
  lexicalOnlyFallback: boolean;
}

export class RagService {
  /**
   * Chunk, embed with the canonical embedding provider/model, and persist vector chunks.
   */
  public async indexDocumentUnits(
    doc: DocumentModel,
    units: ExtractedUnit[],
    previousChunkCount: number,
    auth: AuthContext
  ): Promise<{
    chunkCount: number;
    embeddingProvider: 'gemini' | 'openai' | 'lexical-fallback';
    embeddingModel: string;
    degradedWarning?: string;
  }> {
    const chunks = chunkingService.buildChunks(units, {
      documentId: doc.id,
      userId: auth.userId,
      notebookId: doc.notebookId,
      sourceTitle: doc.title,
    });

    if (chunks.length === 0) {
      throw new Error('No indexable text chunks could be created from document.');
    }

    const canonical = modelRegistry.getCanonicalEmbeddingConfig();
    let embeddingProvider: 'gemini' | 'openai' | 'lexical-fallback' = canonical.provider;
    let embeddingModel = canonical.model;
    let degradedWarning: string | undefined;

    try {
      const { vectors, model, provider } = await aiManagerService.embedTexts(
        chunks.map((c) => c.content),
        'RETRIEVAL_DOCUMENT',
        canonical.provider
      );
      embeddingProvider = provider;
      embeddingModel = model;
      chunks.forEach((chunk, idx) => {
        chunk.embedding = vectors[idx];
        chunk.embeddingProvider = provider;
        chunk.embeddingModel = model;
      });
    } catch (err: any) {
      degradedWarning = `Vector embedding unavailable (${err?.message || 'embedding error'}); lexical search fallback indexed.`;
      embeddingProvider = 'lexical-fallback';
      embeddingModel = 'lexical-fallback';
      chunks.forEach((chunk) => {
        delete chunk.embedding;
        chunk.embeddingProvider = 'lexical-fallback';
        chunk.embeddingModel = 'lexical-fallback';
      });
    }

    await chunkRepository.replaceDocumentChunks(doc, previousChunkCount, chunks, auth);

    return {
      chunkCount: chunks.length,
      embeddingProvider,
      embeddingModel,
      degradedWarning,
    };
  }

  /**
   * Format selected chunks into safe citation XML blocks and structured citations.
   */
  public formatChunksAsContext(
    chosen: Array<{ chunk: DocumentChunkModel; score: number }>,
    docMap: Map<string, DocumentModel>
  ): { citations: DocumentCitation[]; formattedContext: string } {
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
        const docTitle = (chunk.sourceTitle || parentDoc?.title || 'Source Document').replace(
          /["<>]/g,
          ''
        );
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

    return { citations, formattedContext };
  }

  /**
   * Fetch ordered indexed chunks for explicit document grounding or full-document map-reduce summarization.
   */
  public async getOrderedChunksForDocuments(
    auth: AuthContext,
    selectedDocumentIds: string[],
    notebookId?: string
  ): Promise<{
    docs: DocumentModel[];
    chunks: DocumentChunkModel[];
    docMap: Map<string, DocumentModel>;
  }> {
    const allDocs = await documentRepository.findAll(auth, notebookId);
    const idSet = new Set(selectedDocumentIds);
    const docs = allDocs.filter(
      (d) => idSet.has(d.id) && d.processingStatus !== 'failed' && (d.chunkCount || 0) > 0
    );
    if (docs.length === 0) {
      return { docs: [], chunks: [], docMap: new Map() };
    }
    const chunks = await chunkRepository.getChunksForDocuments(docs.slice(0, 20), auth);
    const docMap = new Map(docs.map((d) => [d.id, d]));
    return { docs, chunks, docMap };
  }

  /**
   * Hybrid vector + lexical retrieval across user-owned documents with strict canonical vector-space matching.
   */
  public async retrieveContext(opts: RetrieveContextOptions): Promise<RetrieveContextResult> {
    const canonical = modelRegistry.getCanonicalEmbeddingConfig();
    const allDocs = await documentRepository.findAll(opts.auth, opts.notebookId);
    const readyDocs = allDocs.filter(
      (d) => d.processingStatus !== 'failed' && (d.chunkCount || 0) > 0
    );

    const scopedDocs =
      opts.selectedDocumentIds && opts.selectedDocumentIds.length > 0
        ? readyDocs.filter((d) => opts.selectedDocumentIds!.includes(d.id))
        : readyDocs;

    // Bound fetched documents to avoid excessive Firestore batchGet calls on large libraries
    const targetDocs = scopedDocs.slice(0, 25);

    if (targetDocs.length === 0) {
      return {
        citations: [],
        formattedContext: '',
        hasEvidence: false,
        searchedDocumentCount: 0,
        needsReindexDocumentIds: [],
        embeddingProviderUsed: canonical.provider,
        embeddingModelUsed: canonical.model,
        lexicalOnlyFallback: false,
      };
    }

    const needsReindexDocumentIds = targetDocs
      .filter((d) => {
        if (!d.embeddingModel || d.embeddingModel === 'lexical-fallback') return true;
        const docProvider = d.embeddingProvider || 'gemini';
        return docProvider !== canonical.provider || d.embeddingModel !== canonical.model;
      })
      .map((d) => d.id);

    const chunks = await chunkRepository.getChunksForDocuments(targetDocs, opts.auth);
    if (chunks.length === 0) {
      return {
        citations: [],
        formattedContext: '',
        hasEvidence: false,
        searchedDocumentCount: targetDocs.length,
        needsReindexDocumentIds,
        embeddingProviderUsed: canonical.provider,
        embeddingModelUsed: canonical.model,
        lexicalOnlyFallback: true,
      };
    }

    let queryVector: number[] | null = null;
    let queryProvider: 'gemini' | 'openai' | 'lexical-fallback' = canonical.provider;
    let queryModel: string = canonical.model;

    try {
      const emb = await aiManagerService.embedTexts(
        [opts.query],
        'RETRIEVAL_QUERY',
        canonical.provider
      );
      queryVector = emb.vectors[0] || null;
      queryProvider = emb.provider;
      queryModel = emb.model;
    } catch {
      queryVector = null;
      queryProvider = 'lexical-fallback';
      queryModel = 'lexical-fallback';
    }

    const queryTokens = tokenizeKeywords(opts.query);
    const docMap = new Map(targetDocs.map((d) => [d.id, d]));

    let compatibleVectorCount = 0;

    const scored = chunks.map((chunk) => {
      const lex = lexicalScore(queryTokens, chunk.content, chunk.sectionHeading);
      const chunkProvider = chunk.embeddingProvider || (chunk.embedding?.length ? 'gemini' : undefined);
      const chunkModel = chunk.embeddingModel;

      const isCompatibleVector =
        Boolean(queryVector) &&
        Array.isArray(chunk.embedding) &&
        chunk.embedding.length > 0 &&
        chunk.embedding.length === queryVector!.length &&
        chunkProvider === queryProvider &&
        chunkModel === queryModel;

      let vec = 0;
      if (isCompatibleVector) {
        compatibleVectorCount++;
        vec = Math.max(0, cosineSimilarity(queryVector!, chunk.embedding!));
      }

      const score = isCompatibleVector ? vec * 0.72 + lex * 0.28 : lex;
      return { chunk, score, vec, lex, isCompatibleVector };
    });

    const lexicalOnlyFallback = !queryVector || compatibleVectorCount === 0;
    scored.sort((a, b) => b.score - a.score);

    const minScore = opts.minScore ?? (lexicalOnlyFallback ? 0.12 : 0.26);
    const topK = Math.min(20, Math.max(1, opts.topK ?? 10));
    const maxTokens = opts.maxContextTokens ?? 6000;

    const seenHashes = new Set<string>();
    const perDocCounts = new Map<string, number>();
    const maxPerDoc =
      targetDocs.length > 1 ? Math.max(2, Math.ceil(topK / targetDocs.length) + 1) : topK;

    const chosen: Array<{ chunk: DocumentChunkModel; score: number }> = [];
    let runningTokens = 0;

    for (const item of scored) {
      if (item.score < minScore && chosen.length > 0) break;
      if (item.score < minScore && chosen.length === 0) continue;

      if (item.chunk.contentHash && seenHashes.has(item.chunk.contentHash)) continue;
      const docCount = perDocCounts.get(item.chunk.documentId) || 0;
      if (
        docCount >= maxPerDoc &&
        scored.some(
          (s) => (perDocCounts.get(s.chunk.documentId) || 0) === 0 && s.score >= minScore
        )
      ) {
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
        needsReindexDocumentIds,
        embeddingProviderUsed: queryProvider,
        embeddingModelUsed: queryModel,
        lexicalOnlyFallback,
      };
    }

    const { citations, formattedContext } = this.formatChunksAsContext(chosen, docMap);

    return {
      citations,
      formattedContext,
      hasEvidence: true,
      searchedDocumentCount: targetDocs.length,
      needsReindexDocumentIds,
      embeddingProviderUsed: queryProvider,
      embeddingModelUsed: queryModel,
      lexicalOnlyFallback,
    };
  }
}

export const ragService = new RagService();
