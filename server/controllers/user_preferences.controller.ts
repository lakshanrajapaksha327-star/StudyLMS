import { Request, Response } from 'express';
import { userPreferencesRepository } from '../repositories/user_preferences.repository';

export class UserPreferencesController {
  public async getPreferences(req: Request, res: Response) {
    try {
      const userId = (req.query.userId as string) || '1';
      const prefs = await userPreferencesRepository.getByUserId(userId);
      res.json({ success: true, preferences: prefs });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to retrieve user preferences' });
    }
  }

  public async updatePreferences(req: Request, res: Response) {
    try {
      const userId = req.body.userId || '1';
      const updates = req.body.updates || req.body;
      delete updates.userId;

      const updated = await userPreferencesRepository.updatePreferences(userId, updates);
      res.json({ success: true, preferences: updated });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to update user preferences' });
    }
  }
}

export const userPreferencesController = new UserPreferencesController();
