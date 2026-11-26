import React, { useEffect } from 'react';
import { X, CheckCircle2, Circle, Sparkles, ArrowRight } from 'lucide-react';
import { ActiveTab } from '../types';

export interface OnboardingChecklistState {
  hasNotebook: boolean;
  hasDocument: boolean;
  hasChat: boolean;
  hasNote: boolean;
  hasFlashcards: boolean;
  hasQuiz: boolean;
  hasStudySession: boolean;
  hasLanguageConfigured: boolean;
  hasAdvancedStudio: boolean;
}

interface OnboardingChecklistModalProps {
  isOpen: boolean;
  state: OnboardingChecklistState;
  onClose: () => void;
  onDismissForever: () => void;
  onNavigate: (tab: ActiveTab) => void;
}

export const OnboardingChecklistModal: React.FC<OnboardingChecklistModalProps> = ({
  isOpen,
  state,
  onClose,
  onDismissForever,
  onNavigate,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const steps: Array<{ label: string; done: boolean; tab: ActiveTab }> = [
    { label: '1. Create or organize a Notebook', done: state.hasNotebook, tab: 'dashboard' },
    { label: '2. Upload a lecture PDF, slides, or text source', done: state.hasDocument, tab: 'notebooklm' },
    { label: '3. Ask Study Chat a source-grounded question', done: state.hasChat, tab: 'chat' },
    { label: '4. Write or refine a Smart Note', done: state.hasNote, tab: 'notes' },
    { label: '5. Practice with SM-2 Flashcards', done: state.hasFlashcards, tab: 'flashcards' },
    { label: '6. Complete a Quiz & review mistakes', done: state.hasQuiz, tab: 'quiz' },
    { label: '7. Log a focused Study Session in Analytics', done: state.hasStudySession, tab: 'analytics' },
    { label: '8. Set preferred study language in Settings', done: state.hasLanguageConfigured, tab: 'settings' },
    { label: '9. Try Exam Prep, Visual Studio, or Adaptive Tutor', done: state.hasAdvancedStudio, tab: 'adaptive' },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const pct = Math.round((completedCount / steps.length) * 100);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Getting Started Checklist"
      className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-500" /> Welcome to StudyLMS
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Optional getting-started checklist tracked against your real workspace progress ({completedCount}/{steps.length}).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close onboarding checklist"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-600 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {steps.map((step) => (
            <button
              key={step.label}
              type="button"
              onClick={() => {
                onNavigate(step.tab);
                onClose();
              }}
              className="w-full text-left p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center justify-between gap-2 text-xs transition-colors"
            >
              <span className="flex items-center gap-2.5">
                {step.done ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-slate-400 shrink-0" />
                )}
                <span
                  className={
                    step.done
                      ? 'line-through text-slate-400'
                      : 'font-semibold text-slate-800 dark:text-slate-200'
                  }
                >
                  {step.label}
                </span>
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onDismissForever}
            className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            Dismiss permanently
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
          >
            Continue Studying
          </button>
        </div>
      </div>
    </div>
  );
};
