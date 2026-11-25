import { Request, Response } from 'express';
import { searchHistoryRepository } from '../repositories/search_history.repository';

export class SearchHistoryController {
  public async getRecentSearches(req: Request, res: Response) {
    try {
      const userId = (req.query.userId as string) || '1';
      const searches = await searchHistoryRepository.getRecentSearches(userId);
      res.json({ success: true, searches });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to retrieve search history' });
    }
  }

  public async recordSearch(req: Request, res: Response) {
    try {
      const { userId = '1', keyword, category = 'all', resultCount = 0 } = req.body;
      if (!keyword || !keyword.trim()) {
        return res.status(400).json({ error: 'Keyword is required' });
      }
      const entry = await searchHistoryRepository.recordSearch(
        userId,
        keyword.trim(),
        category,
        resultCount
      );
      res.json({ success: true, entry });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to record search history' });
    }
  }

  public async clearHistory(req: Request, res: Response) {
    try {
      const userId = (req.query.userId as string) || '1';
      await searchHistoryRepository.clearHistory(userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to clear search history' });
    }
  }
}

export const searchHistoryController = new SearchHistoryController();
