import { Router } from 'express';
import { userPreferencesController } from '../controllers/user_preferences.controller';

const router = Router();
router.get('/user-preferences', (req, res, next) =>
  userPreferencesController.getPreferences(req, res, next)
);
router.post('/user-preferences', (req, res, next) =>
  userPreferencesController.updatePreferences(req, res, next)
);
export default router;
