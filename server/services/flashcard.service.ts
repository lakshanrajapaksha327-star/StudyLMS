import { GenerateFlashcardsRequest, FlashcardSetModel } from '../models/flashcard.model';
import { geminiService } from './gemini.service';
import { flashcardRepository } from '../repositories/flashcard.repository';

export class FlashcardService {
  public async generateAndSave(request: GenerateFlashcardsRequest): Promise<FlashcardSetModel> {
    const { topic = 'General Study Topic', sourceContent = '', cardCount = 5, notebookId } = request;

    const cardsData = await geminiService.generateFlashcards(topic, sourceContent, cardCount);

    const setId = `fc-set-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const cards = cardsData.map((c: any, idx: number) => ({
      id: `card-${setId}-${idx + 1}`,
      question: c.question || 'Question',
      answer: c.answer || 'Answer',
      hint: c.hint || undefined,
      status: 'unstudied' as const,
    }));

    const setModel: FlashcardSetModel = {
      id: setId,
      notebookId,
      title: topic,
      description: `AI-generated flashcard deck (${cards.length} cards)`,
      cards,
      createdAt: new Date().toISOString(),
      category: 'AI Generated',
    };

    await flashcardRepository.saveSet(setModel);

    return setModel;
  }

  public async getSets(): Promise<FlashcardSetModel[]> {
    return flashcardRepository.findAllSets();
  }

  public async getSetById(id: string): Promise<FlashcardSetModel | undefined> {
    return flashcardRepository.findSetById(id);
  }

  public async deleteSet(id: string): Promise<boolean> {
    return flashcardRepository.deleteSet(id);
  }
}

export const flashcardService = new FlashcardService();
