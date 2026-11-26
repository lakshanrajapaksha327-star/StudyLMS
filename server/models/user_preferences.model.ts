export interface UserPreferencesModel {
  userId: string;
  theme: 'light' | 'dark' | 'system';
  aiModelPreference: string;
  defaultCardCount?: number;
  socraticTutorMode?: boolean;
  autoSummarize?: boolean;
  language?: string;
  fontSize?: 'small' | 'medium' | 'large';
  notificationsEnabled?: boolean;
  privacyMode?: boolean;
  defaultPersona?: string;
  onboardingDismissed?: boolean;
  updatedAt: string;
}
