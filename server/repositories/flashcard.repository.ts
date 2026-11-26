import { firestoreRest } from '../config/firestore_rest';
import { FlashcardSetModel } from '../models/flashcard.model';
import { AuthContext, pickAllowedKeys } from './base.repository';

const FLASHCARD_SET_KEYS = [
  'id',
  'userId',
  'notebookId',
  'title',
  'description',
  'category',
  'cards',
  'createdAt',
  'updatedAt',
] as const;

export class FlashcardRepository {
  public async saveSet(set: FlashcardSetModel, auth: AuthContext): Promise<FlashcardSetModel> {
    const now = new Date().toISOString();
    const payload: FlashcardSetModel = {
      ...set,
      userId: auth.userId,
      notebookId: (set.notebookId || 'nb-default').replace(/[^a-zA-Z0-9_\-]/g, '-'),
      cards: (set.cards || []).slice(0, 200),
      createdAt: set.createdAt || now,
      updatedAt: now,
    };
    const clean = pickAllowedKeys(payload, FLASHCARD_SET_KEYS) as FlashcardSetModel;
    return firestoreRest.setDoc('flashcard_sets', clean.id, clean, auth.idToken);
  }

  public async findSetById(id: string, auth: AuthContext): Promise<FlashcardSetModel | undefined> {
    const set = await firestoreRest.getDoc<FlashcardSetModel>('flashcard_sets', id, auth.idToken);
    if (!set || set.userId !== auth.userId) return undefined;
    return set;
  }

  public async findAllSets(auth: AuthContext, notebookId?: string): Promise<FlashcardSetModel[]> {
    const list = await firestoreRest.listByUser<FlashcardSetModel>(
      'flashcard_sets',
      auth.userId,
      auth.idToken
    );
    const filtered = notebookId ? list.filter((s) => s.notebookId === notebookId) : list;
    return filtered.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  public async deleteSet(id: string, auth: AuthContext): Promise<boolean> {
    const existing = await this.findSetById(id, auth);
    if (!existing) return false;
    return firestoreRest.deleteDoc('flashcard_sets', id, auth.idToken);
  }
}

export const flashcardRepository = new FlashcardRepository();
