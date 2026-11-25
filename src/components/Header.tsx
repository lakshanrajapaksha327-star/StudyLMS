import React from 'react';
import {
  Sparkles,
  BookOpen,
  Search,
  PlusCircle,
  BrainCircuit,
  Zap,
  Clock
} from 'lucide-react';
import { Notebook } from '../types';
import { NotificationDropdown } from './NotificationDropdown';

interface HeaderProps {
  notebook: Notebook | undefined;
  sourceCount: number;
  noteCount: number;
  cardCount: number;
  onQuickUpload: () => void;
  onQuickQuiz: () => void;
  onOpenSearch?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  notebook,
  sourceCount,
  noteCount,
  cardCount,
  onQuickUpload,
  onQuickQuiz,
  onOpenSearch,
}) => {
  return (
    <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-10">
      {/* Current Active Notebook Info */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
          <BookOpen className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {notebook?.title || 'General Workspace'}
            </h2>
            <span className="text-[10px] font-medium bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800/50">
              Active Notebook
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
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
        className="hidden lg:flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-500 dark:text-slate-400 w-72 transition-all cursor-pointer"
      >
        <Search className="w-3.5 h-3.5 text-indigo-500" />
        <span className="flex-1 text-left">Search everything...</span>
        <kbd className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded text-[10px] font-mono">
          ⌘K
        </kbd>
      </button>

      {/* Right Controls & AI Engine Indicator */}
      <div className="flex items-center gap-3">
        {/* Mobile Search Button */}
        <button
          onClick={onOpenSearch}
          className="lg:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Notifications */}
        <NotificationDropdown />

        {/* Model Engine Status */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
          <BrainCircuit className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
          <span className="font-medium text-slate-700 dark:text-slate-300">Gemini 3.6 Flash</span>
          <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-1.5 py-0.5 rounded">
            ONLINE
          </span>
        </div>

        {/* Quick Actions */}
        <button
          onClick={onQuickUpload}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Add Source</span>
        </button>

        <button
          onClick={onQuickQuiz}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white border border-slate-700 transition-all"
        >
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Generate Quiz</span>
        </button>
      </div>
    </header>
  );
};

