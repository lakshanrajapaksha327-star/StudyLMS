import { FlashcardSetModel, GenerateFlashcardsRequest } from '../models/flashcard.model';
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
      cardCount = 5,
      notebookId,
      selectedDocumentIds,
    } = request;

    const resolvedNbId =
      notebookId && notebookId.trim()
        ? notebookId.trim()
        : (await workspaceRepository.ensureDefaultNotebook(auth)).id;

    let combinedSource = sourceContent;
    if (!combinedSource.trim()) {
      const rag = await ragService.retrieveContext({
        query: topic,
        auth,
        notebookId: resolvedNbId,
        selectedDocumentIds,
        topK: 8,
      });
      if (rag.hasEvidence) {
        combinedSource = rag.formattedContext;
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
      question: c.question || 'Question',
      answer: c.answer || 'Answer',
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
      description: `AI-generated flashcard deck (${cards.length} cards)`,
      cards,
      createdAt: now,
      updatedAt: now,
      category: 'AI Generated',
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
