import { modelRegistry } from '../ai/model-registry';
import { firestoreRest } from '../config/firestore_rest';
import { UserPreferencesModel } from '../models/user_preferences.model';
import { AuthContext, pickAllowedKeys } from './base.repository';

const PREF_KEYS = [
  'userId',
  'theme',
  'aiModelPreference',
  'defaultCardCount',
  'socraticTutorMode',
  'autoSummarize',
  'language',
  'fontSize',
  'notificationsEnabled',
  'privacyMode',
  'defaultPersona',
  'onboardingDismissed',
  'updatedAt',
] as const;

export class UserPreferencesRepository {
  public async getByUserId(auth: AuthContext): Promise<UserPreferencesModel> {
    const defaultModel = modelRegistry.resolveModelForProvider('gemini', 'complex_reasoning');
    const existing = await firestoreRest.getDoc<UserPreferencesModel>(
      'user_preferences',
      auth.userId,
      auth.idToken
    );
    if (existing) {
      return existing;
    }

    const defaults: UserPreferencesModel = {
      userId: auth.userId,
      theme: 'system',
      aiModelPreference: defaultModel,
      defaultCardCount: 6,
      socraticTutorMode: false,
      autoSummarize: true,
      language: 'English',
      fontSize: 'medium',
      notificationsEnabled: true,
      privacyMode: false,
      defaultPersona: 'Standard Tutor',
      onboardingDismissed: false,
      updatedAt: new Date().toISOString(),
    };
    const clean = pickAllowedKeys(defaults, PREF_KEYS) as UserPreferencesModel;
    return firestoreRest.setDoc('user_preferences', auth.userId, clean, auth.idToken);
  }

  public async updatePreferences(
    updates: Partial<UserPreferencesModel> & { preferredAiModel?: string; autoSummarizeOnUpload?: boolean },
    auth: AuthContext
  ): Promise<UserPreferencesModel> {
    const current = await this.getByUserId(auth);
    const defaultModel = modelRegistry.resolveModelForProvider('gemini', 'complex_reasoning');

    const mappedModel = updates.aiModelPreference || updates.preferredAiModel;
    const next: UserPreferencesModel = {
      ...current,
      theme: updates.theme || current.theme || 'system',
      aiModelPreference: mappedModel
        ? modelRegistry.resolveModelForProvider('gemini', 'complex_reasoning', mappedModel)
        : current.aiModelPreference || defaultModel,
      defaultCardCount:
        typeof updates.defaultCardCount === 'number'
          ? updates.defaultCardCount
          : current.defaultCardCount ?? 6,
      socraticTutorMode:
        typeof updates.socraticTutorMode === 'boolean'
          ? updates.socraticTutorMode
          : current.socraticTutorMode ?? false,
      autoSummarize:
        typeof updates.autoSummarize === 'boolean'
          ? updates.autoSummarize
          : typeof updates.autoSummarizeOnUpload === 'boolean'
          ? updates.autoSummarizeOnUpload
          : current.autoSummarize ?? true,
      language: updates.language || current.language || 'English',
      fontSize:
        updates.fontSize === 'small' || updates.fontSize === 'large' || updates.fontSize === 'medium'
          ? updates.fontSize
          : current.fontSize || 'medium',
      notificationsEnabled:
        typeof updates.notificationsEnabled === 'boolean'
          ? updates.notificationsEnabled
          : current.notificationsEnabled ?? true,
      privacyMode:
        typeof updates.privacyMode === 'boolean'
          ? updates.privacyMode
          : current.privacyMode ?? false,
      defaultPersona: updates.defaultPersona || current.defaultPersona || 'Standard Tutor',
      onboardingDismissed:
        typeof updates.onboardingDismissed === 'boolean'
          ? updates.onboardingDismissed
          : current.onboardingDismissed ?? false,
      updatedAt: new Date().toISOString(),
    };

    const clean = pickAllowedKeys(next, PREF_KEYS) as UserPreferencesModel;
    return firestoreRest.setDoc('user_preferences', auth.userId, clean, auth.idToken);
  }
}

export const userPreferencesRepository = new UserPreferencesRepository();
