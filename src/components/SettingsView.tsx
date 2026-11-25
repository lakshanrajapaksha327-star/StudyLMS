import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  User,
  Bot,
  Bell,
  Key,
  Save,
  Check,
  Moon,
  Sun,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { UserProfile } from '../types';

interface SettingsViewProps {
  profile: UserProfile;
  onUpdateProfile: (updated: UserProfile) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  profile,
  onUpdateProfile,
}) => {
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [role, setRole] = useState(profile.role);
  const [studyGoalMinutes, setStudyGoalMinutes] = useState(profile.studyGoalMinutes);
  const [preferredAIModel, setPreferredAIModel] = useState(profile.preferredAIModel);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showSanctumToken, setShowSanctumToken] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      ...profile,
      name,
      email,
      role,
      studyGoalMinutes,
      preferredAIModel,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-slate-700 dark:text-slate-300" /> Account Settings & Preferences
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage your student profile, Gemini AI model preferences, study targets, and Sanctum tokens.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow flex items-center gap-1.5"
        >
          {savedSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          <span>{savedSuccess ? 'Settings Saved' : 'Save Changes'}</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Profile Card */}
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
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Account Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="Student">Student</option>
                <option value="Educator">Educator / TA</option>
                <option value="Admin">Administrator</option>
              </select>
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

        {/* AI Model Preferences */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Bot className="w-4 h-4 text-purple-500" /> AI Grounding Model Engine
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Select Default Gemini AI Engine
            </label>
            <select
              value={preferredAIModel}
              onChange={(e) => setPreferredAIModel(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="Gemini 2.5 Flash (Fast Grounding)">Gemini 2.5 Flash (Ultra Fast Grounding & Low Latency)</option>
              <option value="Gemini 2.5 Pro (Deep Reasoning)">Gemini 2.5 Pro (Deep Multimodal Reasoning)</option>
            </select>
            <p className="text-[11px] text-slate-400 mt-1.5">
              Gemini 2.5 Flash provides optimal speed for NotebookLM source retrieval and Quizlet deck creation.
            </p>
          </div>
        </div>

        {/* Sanctum API Token Section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Key className="w-4 h-4 text-amber-500" /> Laravel Sanctum API Tokens
          </h3>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Personal Access Bearer Token
              </h4>
              <p className="text-[11px] text-slate-400">
                Used for mobile sync or external API integrations.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowSanctumToken(!showSanctumToken)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {showSanctumToken ? 'Hide Token' : 'Reveal Token'}
            </button>
          </div>

          {showSanctumToken && (
            <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-950 font-mono text-xs text-amber-600 dark:text-amber-400 break-all border border-slate-200 dark:border-slate-800">
              1|sanctum_token_8a9f2e3d7c1b0a8f9e2d3c4b5a6f7e8d9c0b1a2f
            </div>
          )}
        </div>
      </form>
    </div>
  );
};
