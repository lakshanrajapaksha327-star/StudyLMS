import { ApiError } from '../middleware/validate.middleware';
import {
  FlashcardSetModel,
  FlashcardSourceCitationRef,
  GenerateFlashcardsRequest,
} from '../models/flashcard.model';
import { AuthContext, makeSafeId } from '../repositories/base.repository';
import { flashcardRepository } from '../repositories/flashcard.repository';
import { workspaceRepository } from '../repositories/workspace.repository';
import { geminiService } from './gemini.service';
import { ragService } from './rag.service';

export class FlashcardService {
  public async generateAndSave(
    request: GenerateFlashcardsRequest,
    auth: AuthContext
  ): Promise<FlashcardSetModel> {
    const {
      topic = 'General Study Topic',
      sourceContent = '',
      sourceMode: explicitMode,
      cardCount = 5,
      notebookId,
      selectedDocumentIds = [],
    } = request;

    const sourceMode: 'document' | 'note' | 'topic' =
      explicitMode ||
      (selectedDocumentIds.length > 0
        ? 'document'
        : sourceContent.trim()
        ? 'note'
        : 'topic');

    const resolvedNbId =
      notebookId && notebookId.trim()
        ? notebookId.trim()
        : (await workspaceRepository.ensureDefaultNotebook(auth)).id;

    let combinedSource = '';
    let groundingMode: 'source_grounded' | 'general_knowledge' = 'general_knowledge';
    let sourceCitations: FlashcardSourceCitationRef[] = [];

    if (sourceMode === 'document') {
      if (!selectedDocumentIds || selectedDocumentIds.length === 0) {
        throw new ApiError(400, 'Select at least one document in Document mode.', 'NO_DOCUMENTS_SELECTED');
      }

      const rag = await ragService.retrieveContext({
        query: topic?.trim() || 'key concepts, definitions, principles, and exam facts',
        auth,
        notebookId: resolvedNbId,
        selectedDocumentIds,
        topK: 12,
        maxContextTokens: 7000,
      });

      if (rag.hasEvidence) {
        combinedSource = rag.formattedContext;
        groundingMode = 'source_grounded';
        sourceCitations = rag.citations.slice(0, 8).map((c) => ({
          documentId: c.documentId,
          documentTitle: c.documentTitle,
          chunkId: c.chunkId,
          pageNumber: c.pageNumber,
          slideNumber: c.slideNumber,
        }));
      } else {
        const ordered = await ragService.getOrderedChunksForDocuments(
          auth,
          selectedDocumentIds,
          resolvedNbId
        );
        if (ordered.chunks.length === 0) {
          throw new ApiError(
            422,
            'Selected document(s) have no indexed study chunks yet. Please re-index or retry processing before generating flashcards.',
            'NO_INDEXED_CHUNKS'
          );
        }
        const slice = ordered.chunks
          .slice(0, 12)
          .map((chunk) => ({ chunk, score: 1 }));
        const formatted = ragService.formatChunksAsContext(slice, ordered.docMap);
        combinedSource = formatted.formattedContext;
        groundingMode = 'source_grounded';
        sourceCitations = formatted.citations.slice(0, 8).map((c) => ({
          documentId: c.documentId,
          documentTitle: c.documentTitle,
          chunkId: c.chunkId,
          pageNumber: c.pageNumber,
          slideNumber: c.slideNumber,
        }));
      }
    } else if (sourceMode === 'note') {
      if (!sourceContent.trim()) {
        throw new ApiError(400, 'Selected study note is empty.', 'NO_NOTE_CONTENT');
      }
      combinedSource = sourceContent;
      groundingMode = 'source_grounded';
    } else {
      if (selectedDocumentIds.length > 0 || sourceContent.trim()) {
        combinedSource = sourceContent;
        if (sourceContent.trim()) {
          groundingMode = 'source_grounded';
        }
      }
      if (!combinedSource.trim()) {
        const rag = await ragService.retrieveContext({
          query: topic,
          auth,
          notebookId: resolvedNbId,
          selectedDocumentIds: selectedDocumentIds.length > 0 ? selectedDocumentIds : undefined,
          topK: 8,
        });
        if (rag.hasEvidence) {
          combinedSource = rag.formattedContext;
          groundingMode = 'source_grounded';
          sourceCitations = rag.citations.slice(0, 8).map((c) => ({
            documentId: c.documentId,
            documentTitle: c.documentTitle,
            chunkId: c.chunkId,
            pageNumber: c.pageNumber,
            slideNumber: c.slideNumber,
          }));
        }
      }
    }

    const cardsData = await geminiService.generateFlashcards(
      topic,
      combinedSource,
      cardCount,
      auth
    );

    const setId = makeSafeId('fcset');
    const now = new Date().toISOString();

    const cards = cardsData.map((c: any, idx: number) => ({
      id: `card-${setId}-${idx + 1}`,
      question: c.question,
      answer: c.answer,
      hint: c.hint || undefined,
      status: 'unstudied' as const,
      box: 1,
      easeFactor: 2.5,
      intervalDays: 0,
      repetitions: 0,
      starred: false,
      difficult: false,
    }));

    const setModel: FlashcardSetModel = {
      id: setId,
      userId: auth.userId,
      notebookId: resolvedNbId,
      title: topic,
      description: `AI-generated flashcard deck (${cards.length} cards, ${groundingMode === 'source_grounded' ? 'source grounded' : 'general knowledge'})`,
      cards,
      createdAt: now,
      updatedAt: now,
      category: groundingMode === 'source_grounded' ? 'Source Grounded' : 'AI Generated',
      groundingMode,
      sourceDocumentIds: selectedDocumentIds.length > 0 ? selectedDocumentIds : undefined,
      sourceCitations: sourceCitations.length > 0 ? sourceCitations : undefined,
    };

    return flashcardRepository.saveSet(setModel, auth);
  }

  public async saveOrUpdateSet(set: FlashcardSetModel, auth: AuthContext): Promise<FlashcardSetModel> {
    return flashcardRepository.saveSet(set, auth);
  }

  public async getSets(auth: AuthContext, notebookId?: string): Promise<FlashcardSetModel[]> {
    return flashcardRepository.findAllSets(auth, notebookId);
  }

  public async getSetById(id: string, auth: AuthContext): Promise<FlashcardSetModel | undefined> {
    return flashcardRepository.findSetById(id, auth);
  }

  public async deleteSet(id: string, auth: AuthContext): Promise<boolean> {
    return flashcardRepository.deleteSet(id, auth);
  }
}

export const flashcardService = new FlashcardService();
