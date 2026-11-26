import { firestoreRest } from '../config/firestore_rest';
import { SearchHistoryModel } from '../models/search_history.model';
import { AuthContext, makeSafeId, pickAllowedKeys } from './base.repository';

const SEARCH_HISTORY_KEYS = [
  'id',
  'userId',
  'keyword',
  'category',
  'resultCount',
  'createdAt',
] as const;

export class SearchHistoryRepository {
  public async recordSearch(
    keyword: string,
    category: 'documents' | 'flashcards' | 'quizzes' | 'notes' | 'chats' | 'all',
    resultCount: number,
    auth: AuthContext
  ): Promise<SearchHistoryModel> {
    const entry: SearchHistoryModel = {
      id: makeSafeId('sh'),
      userId: auth.userId,
      keyword: keyword.slice(0, 195),
      category: category || 'all',
      resultCount: Number(resultCount) || 0,
      createdAt: new Date().toISOString(),
    };
    const clean = pickAllowedKeys(entry, SEARCH_HISTORY_KEYS) as SearchHistoryModel;
    return firestoreRest.setDoc('search_history', clean.id, clean, auth.idToken);
  }

  public async getRecentSearches(auth: AuthContext, limit = 15): Promise<SearchHistoryModel[]> {
    const list = await firestoreRest.listByUser<SearchHistoryModel>(
      'search_history',
      auth.userId,
      auth.idToken
    );
    return list
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, limit);
  }

  public async clearHistory(auth: AuthContext): Promise<void> {
    const list = await firestoreRest.listByUser<SearchHistoryModel>(
      'search_history',
      auth.userId,
      auth.idToken
    );
    for (const item of list) {
      await firestoreRest.deleteDoc('search_history', item.id, auth.idToken).catch(() => {});
    }
  }
}

export const searchHistoryRepository = new SearchHistoryRepository();
