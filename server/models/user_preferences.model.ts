export interface UserPreferencesModel {
  id: string;
  userId: string;
  theme: 'light' | 'dark' | 'system';
  language: string;
  fontFamily: 'Inter' | 'Plus Jakarta Sans' | 'Playfair Display' | 'JetBrains Mono';
  preferredAiModel: 'gemini-3.6-flash' | 'gemini-3.1-pro' | 'gemini-2.5-flash';
  studyGoalMinutes: number;
  studyNotificationsEnabled: boolean;
  autoSummarizeOnUpload: boolean;
  createdAt: string;
  updatedAt: string;
}
