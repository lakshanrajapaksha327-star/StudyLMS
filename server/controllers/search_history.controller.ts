import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../middleware/validate.middleware';
import { getAuthContext } from '../repositories/base.repository';
import { searchHistoryRepository } from '../repositories/search_history.repository';

export class SearchHistoryController {
  public async getRecentSearches(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const searches = await searchHistoryRepository.getRecentSearches(auth);
      res.json({ success: true, searches });
    } catch (err) {
      next(err);
    }
  }

  public async recordSearch(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { keyword, category = 'all', resultCount = 0 } = req.body;
      if (!keyword || !String(keyword).trim()) {
        throw new ApiError(400, 'Keyword is required.');
      }
      const entry = await searchHistoryRepository.recordSearch(
        String(keyword).trim(),
        category,
        Number(resultCount) || 0,
        auth
      );
      res.json({ success: true, entry });
    } catch (err) {
      next(err);
    }
  }

  public async clearHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      await searchHistoryRepository.clearHistory(auth);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}

export const searchHistoryController = new SearchHistoryController();
