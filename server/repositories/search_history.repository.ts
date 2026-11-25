import { SearchHistoryModel } from '../models/search_history.model';

class SearchHistoryRepository {
  private history: SearchHistoryModel[] = [];

  public async recordSearch(
    userId: string,
    keyword: string,
    category?: 'documents' | 'flashcards' | 'quizzes' | 'notes' | 'chats' | 'all',
    resultCount = 0
  ): Promise<SearchHistoryModel> {
    const entry: SearchHistoryModel = {
      id: `search-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      userId,
      keyword,
      category: category || 'all',
      resultCount,
      createdAt: new Date().toISOString(),
    };
    this.history.unshift(entry);
    return entry;
  }

  public async getRecentSearches(userId: string, limit = 10): Promise<SearchHistoryModel[]> {
    return this.history.filter((h) => h.userId === userId || !h.userId).slice(0, limit);
  }

  public async clearHistory(userId: string): Promise<void> {
    this.history = this.history.filter((h) => h.userId !== userId);
  }
}

export const searchHistoryRepository = new SearchHistoryRepository();
