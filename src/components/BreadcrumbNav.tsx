import React from 'react';
import { ChevronRight, Home, BookOpen, Layers, HelpCircle, FileText, Notebook as NotebookIcon, Calendar, Wand2, History, Settings, ShieldCheck, Sparkles } from 'lucide-react';
import { ActiveTab, Notebook } from '../types';

interface BreadcrumbNavProps {
  activeTab: ActiveTab;
  notebook?: Notebook;
  onNavigate: (tab: ActiveTab) => void;
}

export const BreadcrumbNav: React.FC<BreadcrumbNavProps> = ({ activeTab, notebook, onNavigate }) => {
  const getTabLabel = (tab: ActiveTab) => {
    switch (tab) {
      case 'dashboard':
        return 'Dashboard Overview';
      case 'planner':
        return 'AI Study Planner';
      case 'notebooklm':
        return 'NotebookLM Grounded Sources';
      case 'chat':
        return 'ChatGPT Socratic Tutor';
      case 'notes':
        return 'Notion AI Study Notes';
      case 'flashcards':
        return 'Quizlet Flashcard Decks';
      case 'quiz':
        return 'Practice Tests';
      case 'summary':
        return 'Executive Summary';
      case 'toolkit':
        return 'STEM & AI Toolkit';
      case 'adaptive':
        return 'Adaptive Tutor & Revision';
      case 'examprep':
        return 'Smart Exam Prep';
      case 'visuals':
        return 'Visual Learning Studio';
      case 'audio':
        return 'Audio Lecture Assistant';
      case 'analytics':
        return 'Learning Analytics';
      case 'history':
        return 'Activity History Logs';
      case 'settings':
        return 'Account & Settings';
      case 'admin':
        return 'Admin Portal';
      default:
        return 'Workspace';
    }
  };

  return (
    <nav className="flex items-center gap-2 px-8 py-2.5 text-xs text-slate-500 dark:text-slate-400 bg-white/40 dark:bg-slate-900/40 border-b border-slate-200/60 dark:border-slate-800/60 backdrop-blur-xs">
      <button
        onClick={() => onNavigate('dashboard')}
        className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
      >
        <Home className="w-3.5 h-3.5" />
        <span>Home</span>
      </button>

      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />

      {notebook && (
        <>
          <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
            <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
            {notebook.title}
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        </>
      )}

      <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
        {getTabLabel(activeTab)}
      </span>
    </nav>
  );
};
