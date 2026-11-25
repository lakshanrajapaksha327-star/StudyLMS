import { Router } from 'express';
import { userPreferencesController } from '../controllers/user_preferences.controller';

const router = Router();

router.get('/user-preferences', (req, res) =>
  userPreferencesController.getPreferences(req, res)
);
router.post('/user-preferences', (req, res) =>
  userPreferencesController.updatePreferences(req, res)
);

export default router;
