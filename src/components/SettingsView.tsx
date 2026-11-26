import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  User,
  Bot,
  Save,
  Check,
  ShieldCheck,
  AlertCircle,
  KeyRound,
  Download,
  Trash2,
  Cpu,
  AlertTriangle,
} from 'lucide-react';
import { deleteUser } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { AiProviderHealthInfo, UserProfile } from '../types';
import {
  fetchUserPreferences,
  updateUserPreferences,
  updateSessionProfile,
  fetchAiHealthApi,
  exportWorkspaceDataApi,
  deleteWorkspaceAccountApi,
} from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface SettingsViewProps {
  profile: UserProfile;
  onUpdateProfile: (updated: UserProfile) => void;
  onAccountDeleted?: () => void;
  onShowOnboarding?: () => void;
  isAuthenticated?: boolean;
}

const normalizeLanguageLabel = (raw?: string): 'English' | 'Sinhala' | 'Tamil' => {
  const low = (raw || '').toLowerCase();
  if (low === 'si' || low === 'sinhala') return 'Sinhala';
  if (low === 'ta' || low === 'tamil') return 'Tamil';
  return 'English';
};

const applyAppearance = (theme: 'light' | 'dark' | 'system', fontSize: 'small' | 'medium' | 'large') => {
  const root = document.documentElement;
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  const useDark = theme === 'dark' || (theme === 'system' && prefersDark);
  root.classList.toggle('dark', useDark);

  root.style.fontSize = fontSize === 'small' ? '14px' : fontSize === 'large' ? '18px' : '16px';
};

export const SettingsView: React.FC<SettingsViewProps> = ({
  profile,
  onUpdateProfile,
  onAccountDeleted,
  onShowOnboarding,
  isAuthenticated = false,
}) => {
  const { user, resetPassword, signOut } = useAuth();
  const [name, setName] = useState(profile.name);
  const [studyGoalMinutes, setStudyGoalMinutes] = useState(profile.studyGoalMinutes);
  const [preferredAIModel, setPreferredAIModel] = useState(
    profile.preferredAIModel || 'gemini-4-hydrogen'
  );
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('dark');
  const [language, setLanguage] = useState<'English' | 'Sinhala' | 'Tamil'>('English');
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [defaultPersona, setDefaultPersona] = useState('Standard Tutor');

  const [providerHealth, setProviderHealth] = useState<AiProviderHealthInfo[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [noticeMsg, setNoticeMsg] = useState('');

  const [exporting, setExporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    setName(profile.name);
    setStudyGoalMinutes(profile.studyGoalMinutes);
    setPreferredAIModel(profile.preferredAIModel || 'gemini-4-hydrogen');
  }, [profile]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchUserPreferences()
      .then((prefs) => {
        if (prefs) {
          const nextTheme = prefs.theme || 'dark';
          const nextFont = prefs.fontSize || 'medium';
          setTheme(nextTheme);
          setLanguage(normalizeLanguageLabel(prefs.language));
          setFontSize(nextFont);
          if (prefs.aiModelPreference || prefs.aiModel) {
            setPreferredAIModel(prefs.aiModelPreference || prefs.aiModel);
          }
          if (typeof prefs.notificationsEnabled === 'boolean') {
            setNotificationsEnabled(prefs.notificationsEnabled);
          }
          if (typeof prefs.privacyMode === 'boolean') {
            setPrivacyMode(prefs.privacyMode);
          }
          if (prefs.defaultPersona) setDefaultPersona(prefs.defaultPersona);
          applyAppearance(nextTheme, nextFont);
        }
      })
      .catch(() => {});

    fetchAiHealthApi()
      .then((data) => {
        if (Array.isArray(data?.providers)) setProviderHealth(data.providers);
      })
      .catch(() => {});
  }, [isAuthenticated]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setNoticeMsg('');

    try {
      const updatedProfile: UserProfile = {
        ...profile,
        name: name.trim() || profile.name,
        studyGoalMinutes,
        preferredAIModel,
      };

      applyAppearance(theme, fontSize);

      if (isAuthenticated) {
        await Promise.all([
          updateSessionProfile({
            name: updatedProfile.name,
            studyGoalMinutes: Number(studyGoalMinutes),
          }),
          updateUserPreferences({
            theme,
            language,
            fontSize,
            aiModelPreference: preferredAIModel,
            notificationsEnabled,
            privacyMode,
            defaultPersona,
          }),
        ]);
      }

      onUpdateProfile(updatedProfile);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save preferences.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    const email = user?.email || profile.email;
    if (!email) {
      setErrorMsg('No email address found for password reset.');
      return;
    }
    setErrorMsg('');
    setNoticeMsg('');
    try {
      await resetPassword(email);
      setNoticeMsg(`Password reset email sent to ${email}.`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to send password reset email.');
    }
  };

  const handleExportWorkspace = async () => {
    if (!isAuthenticated) return;
    setExporting(true);
    setErrorMsg('');
    try {
      const data = await exportWorkspaceDataApi();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `studylms_workspace_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setNoticeMsg('Workspace JSON backup downloaded.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to export workspace data.');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!isAuthenticated || !auth.currentUser) return;
    setDeletingAccount(true);
    setErrorMsg('');
    try {
      await deleteWorkspaceAccountApi();
      await deleteUser(auth.currentUser);
      await signOut();
      onAccountDeleted?.();
    } catch (err: any) {
      if (err?.code === 'auth/requires-recent-login') {
        setErrorMsg(
          'Your cloud workspace data was wiped, but Firebase Auth requires a recent sign-in before deleting your auth account. Please sign out and sign back in, then click Delete Account once more.'
        );
      } else {
        setErrorMsg(err?.message || 'Failed to delete account.');
      }
      setConfirmDelete(false);
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-slate-700 dark:text-slate-300" /> Account Settings & Preferences
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage your profile, AI routing preferences, notifications, workspace backup, and account security.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow flex items-center gap-1.5 disabled:opacity-50"
        >
          {savedSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          <span>{saving ? 'Saving...' : savedSuccess ? 'Settings Saved' : 'Save Changes'}</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-500 rounded-2xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {noticeMsg && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 rounded-2xl text-xs flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{noticeMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <User className="w-4 h-4 text-indigo-500" /> Profile Details
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Account Email (Managed by Sign-In)
              </label>
              <input
                type="email"
                readOnly
                value={user?.email || profile.email || 'Not signed in'}
                className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-500 dark:text-slate-400 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Account Role
              </label>
              <input
                type="text"
                readOnly
                value={profile.role}
                className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-500 dark:text-slate-400 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Daily Study Goal (Minutes)
              </label>
              <input
                type="number"
                min="15"
                max="300"
                value={studyGoalMinutes}
                onChange={(e) => setStudyGoalMinutes(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Bot className="w-4 h-4 text-purple-500" /> AI & Workspace Preferences
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Preferred Gemini Model Engine
              </label>
              <select
                value={preferredAIModel}
                onChange={(e) => setPreferredAIModel(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="gemini-4-hydrogen">Gemini 4 Hydrogen (Reasoning & RAG Default)</option>
                <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Low-Latency Fast Grounding)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Default Tutor Persona
              </label>
              <select
                value={defaultPersona}
                onChange={(e) => setDefaultPersona(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="Standard Tutor">Standard Tutor</option>
                <option value="Socratic Tutor">Socratic Tutor</option>
                <option value="Simple Explanation Tutor">Simple Explanation Tutor</option>
                <option value="Exam Preparation Tutor">Exam Preparation Tutor</option>
                <option value="Strict Examiner">Strict Examiner</option>
                <option value="Step-by-Step Tutor">Step-by-Step Tutor</option>
                <option value="Programming Tutor">Programming Tutor</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Theme Preference
              </label>
              <select
                value={theme}
                onChange={(e) => {
                  const next = e.target.value as 'light' | 'dark' | 'system';
                  setTheme(next);
                  applyAppearance(next, fontSize);
                }}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="dark">Dark Mode</option>
                <option value="light">Light Mode</option>
                <option value="system">System Default</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Reader Font Size
              </label>
              <select
                value={fontSize}
                onChange={(e) => {
                  const next = e.target.value as 'small' | 'medium' | 'large';
                  setFontSize(next);
                  applyAppearance(theme, next);
                }}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="small">Compact</option>
                <option value="medium">Standard</option>
                <option value="large">Large</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                AI & Study Output Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'English' | 'Sinhala' | 'Tamil')}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="English">English (Default)</option>
                <option value="Sinhala">Sinhala (සිංහල — technical terms kept in English)</option>
                <option value="Tamil">Tamil (தமிழ் — technical terms kept in English)</option>
              </select>
            </div>

            <div className="flex items-end">
              {onShowOnboarding && (
                <button
                  type="button"
                  onClick={async () => {
                    if (isAuthenticated) {
                      await updateUserPreferences({ onboardingDismissed: false }).catch(() => {});
                    }
                    onShowOnboarding();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 w-full text-center"
                >
                  Show Getting-Started Checklist
                </button>
              )}
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => setNotificationsEnabled(e.target.checked)}
                className="accent-indigo-600"
              />
              Enable due flashcard & exam study reminders
            </label>

            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={privacyMode}
                onChange={(e) => setPrivacyMode(e.target.checked)}
                className="accent-indigo-600"
              />
              Privacy Mode (mask study telemetry metrics)
            </label>
          </div>
        </div>
      </form>

      {/* AI Provider Health Card (Read-Only Server Status) */}
      {isAuthenticated && providerHealth.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-3 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-500" /> AI Provider Routing & Server Health
          </h3>
          <p className="text-[11px] text-slate-500">
            Keys are managed server-side only. Below is the live circuit-breaker & readiness state of configured providers.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {providerHealth.map((p) => (
              <div
                key={p.id}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-slate-100">{p.displayName}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      p.status === 'healthy'
                        ? 'bg-emerald-500/15 text-emerald-500'
                        : p.status === 'unavailable'
                        ? 'bg-slate-500/15 text-slate-400'
                        : 'bg-amber-500/15 text-amber-500'
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">Model: {p.configuredModel}</p>
                <p className="text-[10px] text-slate-500">
                  Circuit: {p.circuitState} • Latency: {p.lastLatencyMs !== null ? `${p.lastLatencyMs}ms` : '—'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Security, Backup & Account Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" /> Security & Workspace Data Controls
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {isAuthenticated
            ? `Signed in via Firebase Authentication (UID: ${user?.uid}). All API requests use short-lived verified Bearer ID tokens.`
            : 'Sign in with Google or email to enable persistent cloud storage, password reset, workspace export, and account controls.'}
        </p>

        {isAuthenticated && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handlePasswordReset}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5 text-indigo-500" /> Send Password Reset Email
            </button>

            <button
              type="button"
              onClick={handleExportWorkspace}
              disabled={exporting}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-emerald-500" />
              <span>{exporting ? 'Exporting...' : 'Export Workspace JSON'}</span>
            </button>

            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 text-xs font-semibold flex items-center gap-1.5 ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Account
              </button>
            ) : (
              <div className="flex items-center gap-2 ml-auto bg-rose-950/30 border border-rose-500/40 px-3 py-1.5 rounded-xl text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                <span className="text-rose-300 font-semibold">Permanently delete all data & account?</span>
                <button
                  type="button"
                  disabled={deletingAccount}
                  onClick={handleDeleteAccount}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold"
                >
                  {deletingAccount ? 'Deleting...' : 'Confirm'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-2 py-1 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
