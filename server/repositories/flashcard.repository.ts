import { FlashcardSetModel } from '../models/flashcard.model';

class FlashcardRepository {
  private sets: Map<string, FlashcardSetModel> = new Map();

  public async saveSet(set: FlashcardSetModel): Promise<FlashcardSetModel> {
    this.sets.set(set.id, set);
    return set;
  }

  public async findSetById(id: string): Promise<FlashcardSetModel | undefined> {
    return this.sets.get(id);
  }

  public async findAllSets(): Promise<FlashcardSetModel[]> {
    return Array.from(this.sets.values());
  }

  public async deleteSet(id: string): Promise<boolean> {
    return this.sets.delete(id);
  }
}

export const flashcardRepository = new FlashcardRepository();
