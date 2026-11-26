import { Request, Response, NextFunction } from 'express';
import { getAuthContext } from '../repositories/base.repository';
import { userPreferencesRepository } from '../repositories/user_preferences.repository';

export class UserPreferencesController {
  public async getPreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const prefs = await userPreferencesRepository.getByUserId(auth);
      res.json({ success: true, preferences: prefs });
    } catch (err) {
      next(err);
    }
  }

  public async updatePreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const updates = { ...(req.body.updates || req.body || {}) };
      delete updates.userId;

      const updated = await userPreferencesRepository.updatePreferences(updates, auth);
      res.json({ success: true, preferences: updated });
    } catch (err) {
      next(err);
    }
  }
}

export const userPreferencesController = new UserPreferencesController();
