import { Router } from 'express';
import { searchHistoryController } from '../controllers/search_history.controller';

const router = Router();
router.get('/search-history', (req, res, next) =>
  searchHistoryController.getRecentSearches(req, res, next)
);
router.post('/search-history', (req, res, next) =>
  searchHistoryController.recordSearch(req, res, next)
);
router.delete('/search-history', (req, res, next) =>
  searchHistoryController.clearHistory(req, res, next)
);
export default router;
