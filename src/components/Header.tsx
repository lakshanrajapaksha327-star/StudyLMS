import React from 'react';
import {
  BookOpen,
  Search,
  PlusCircle,
  BrainCircuit,
  Zap,
  Columns2,
  LogIn,
  Menu,
  ListChecks,
} from 'lucide-react';
import { Notebook, NotificationItem, StudySessionItem } from '../types';
import { NotificationDropdown } from './NotificationDropdown';
import { StudyTimerWidget } from './StudyTimerWidget';

interface HeaderProps {
  notebook: Notebook | undefined;
  sourceCount: number;
  noteCount: number;
  cardCount: number;
  onQuickUpload: () => void;
  onQuickQuiz: () => void;
  onOpenSearch?: () => void;
  onToggleSplitScreen?: () => void;
  onToggleMobileMenu?: () => void;
  onOpenChecklist?: () => void;
  onOpenAuth?: () => void;
  isAuthenticated?: boolean;
  isDemoMode?: boolean;
  userName?: string;
  activeModel?: string;
  notifications?: NotificationItem[];
  onMarkNotificationRead?: (id: string) => void;
  onDeleteNotification?: (id: string) => void;
  onStudySessionSaved?: (session: StudySessionItem) => void;
}

export const Header: React.FC<HeaderProps> = ({
  notebook,
  sourceCount,
  noteCount,
  cardCount,
  onQuickUpload,
  onQuickQuiz,
  onOpenSearch,
  onToggleSplitScreen,
  onToggleMobileMenu,
  onOpenChecklist,
  onOpenAuth,
  isAuthenticated = false,
  isDemoMode = false,
  userName,
  activeModel = 'Gemini AI',
  notifications = [],
  onMarkNotificationRead,
  onDeleteNotification,
  onStudySessionSaved,
}) => {
  return (
    <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 md:px-6 flex items-center justify-between sticky top-0 z-10 gap-2">
      {/* Current Active Notebook Info + Mobile Drawer Button */}
      <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            aria-label="Open navigation menu"
            className="lg:hidden p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
          <BookOpen className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate">
              {notebook?.title || 'Study Workspace'}
            </h2>
            {isDemoMode ? (
              <span className="text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 shrink-0">
                Demo Mode
              </span>
            ) : (
              <span className="hidden sm:inline-block text-[10px] font-medium bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800/50 shrink-0">
                Active Notebook
              </span>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            <span>{sourceCount} Sources</span>
            <span>•</span>
            <span>{noteCount} Notes</span>
            <span>•</span>
            <span>{cardCount} Cards</span>
          </div>
        </div>
      </div>

      {/* Center Search Bar Trigger */}
      <button
        onClick={onOpenSearch}
        aria-label="Open global search"
        className="hidden xl:flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-500 dark:text-slate-400 w-56 transition-all cursor-pointer"
      >
        <Search className="w-3.5 h-3.5 text-indigo-500" />
        <span className="flex-1 text-left">Search everything...</span>
        <kbd className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded text-[10px] font-mono">
          ⌘K
        </kbd>
      </button>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenSearch}
          aria-label="Search workspace"
          className="xl:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
          title="Search"
        >
          <Search className="w-4 h-4" />
        </button>

        <StudyTimerWidget
          activeNotebookId={notebook?.id}
          activeNotebookTitle={notebook?.title}
          isAuthenticated={isAuthenticated}
          onSessionSaved={onStudySessionSaved}
        />

        {onOpenChecklist && (
          <button
            type="button"
            onClick={onOpenChecklist}
            aria-label="Open study checklist"
            title="Study Onboarding Checklist"
            className="hidden md:flex p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-indigo-500"
          >
            <ListChecks className="w-4 h-4" />
          </button>
        )}

        {onToggleSplitScreen && (
          <button
            onClick={onToggleSplitScreen}
            title="Open Split-Screen Reader + Chat"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <Columns2 className="w-3.5 h-3.5 text-indigo-500" />
            <span className="hidden 2xl:inline">Split View</span>
          </button>
        )}

        <NotificationDropdown
          notifications={notifications}
          onMarkRead={onMarkNotificationRead}
          onDeleteNotification={onDeleteNotification}
        />

        <div className="hidden 2xl:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
          <BrainCircuit className="w-3.5 h-3.5 text-emerald-500" />
          <span className="font-medium text-slate-700 dark:text-slate-300">{activeModel}</span>
        </div>

        <button
          onClick={onQuickUpload}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Add Source</span>
        </button>

        <button
          onClick={onQuickQuiz}
          className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white border border-slate-700 transition-all"
        >
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Quiz</span>
        </button>

        {!isAuthenticated && onOpenAuth && (
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
        )}

        {isAuthenticated && userName && (
          <span className="hidden lg:inline-block text-xs font-semibold text-slate-600 dark:text-slate-300 px-2 truncate max-w-[120px]">
            {userName}
          </span>
        )}
      </div>
    </header>
  );
};
