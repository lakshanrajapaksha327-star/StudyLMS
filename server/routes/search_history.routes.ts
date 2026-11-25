import { Router } from 'express';
import { searchHistoryController } from '../controllers/search_history.controller';

const router = Router();

router.get('/search-history', (req, res) =>
  searchHistoryController.getRecentSearches(req, res)
);
router.post('/search-history', (req, res) =>
  searchHistoryController.recordSearch(req, res)
);
router.delete('/search-history', (req, res) =>
  searchHistoryController.clearHistory(req, res)
);

export default router;
