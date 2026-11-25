import { UserPreferencesModel } from '../models/user_preferences.model';

class UserPreferencesRepository {
  private preferences: Map<string, UserPreferencesModel> = new Map();

  constructor() {
    // Default preferences for primary user
    const defaultPrefs: UserPreferencesModel = {
      id: 'pref-default-1',
      userId: '1',
      theme: 'dark',
      language: 'en',
      fontFamily: 'Plus Jakarta Sans',
      preferredAiModel: 'gemini-3.6-flash',
      studyGoalMinutes: 60,
      studyNotificationsEnabled: true,
      autoSummarizeOnUpload: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.preferences.set('1', defaultPrefs);
  }

  public async getByUserId(userId: string): Promise<UserPreferencesModel> {
    if (!this.preferences.has(userId)) {
      const newPrefs: UserPreferencesModel = {
        id: `pref-${Date.now()}`,
        userId,
        theme: 'dark',
        language: 'en',
        fontFamily: 'Plus Jakarta Sans',
        preferredAiModel: 'gemini-3.6-flash',
        studyGoalMinutes: 60,
        studyNotificationsEnabled: true,
        autoSummarizeOnUpload: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.preferences.set(userId, newPrefs);
    }
    return this.preferences.get(userId)!;
  }

  public async updatePreferences(
    userId: string,
    updates: Partial<UserPreferencesModel>
  ): Promise<UserPreferencesModel> {
    const current = await this.getByUserId(userId);
    const updated: UserPreferencesModel = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.preferences.set(userId, updated);
    return updated;
  }
}

export const userPreferencesRepository = new UserPreferencesRepository();
