import React, { useState } from 'react';
import {
  LayoutDashboard,
  Calendar,
  FileText,
  MessageSquareText,
  Notebook as NotebookIcon,
  Layers,
  HelpCircle,
  Plus,
  BookOpen,
  Sparkles,
  Flame,
  ChevronRight,
  GraduationCap,
  History,
  Settings,
  ShieldCheck,
  Home,
  Wand2
} from 'lucide-react';
import { ActiveTab, Notebook, StudyStats } from '../types';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  notebooks: Notebook[];
  activeNotebookId: string;
  setActiveNotebookId: (id: string) => void;
  onCreateNotebook: (title: string, description: string) => void;
  stats: StudyStats;
  onOpenAuth: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  notebooks,
  activeNotebookId,
  setActiveNotebookId,
  onCreateNotebook,
  stats,
  onOpenAuth,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTitle.trim()) {
      onCreateNotebook(newTitle.trim(), newDesc.trim() || 'New AI study workspace');
      setNewTitle('');
      setNewDesc('');
      setShowModal(false);
    }
  };

  const navItems = [
    { id: 'dashboard' as ActiveTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'planner' as ActiveTab, label: 'AI Study Planner', icon: Calendar, badge: 'New' },
    { id: 'notebooklm' as ActiveTab, label: 'Document Library', icon: FileText, badge: 'Sources' },
    { id: 'chat' as ActiveTab, label: 'ChatGPT Tutor', icon: MessageSquareText },
    { id: 'summary' as ActiveTab, label: 'Summary Page', icon: FileText },
    { id: 'notes' as ActiveTab, label: 'Notion AI Notes', icon: NotebookIcon },
    { id: 'flashcards' as ActiveTab, label: 'Quizlet Flashcards', icon: Layers },
    { id: 'quiz' as ActiveTab, label: 'Practice Quizzes', icon: HelpCircle },
    { id: 'toolkit' as ActiveTab, label: 'AI STEM Toolkit', icon: Wand2, badge: 'Pro' },
    { id: 'history' as ActiveTab, label: 'Activity History', icon: History },
    { id: 'settings' as ActiveTab, label: 'Settings', icon: Settings },
    { id: 'admin' as ActiveTab, label: 'Admin Panel', icon: ShieldCheck, badge: 'System' },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800 h-screen sticky top-0 select-none z-20">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <button
          onClick={() => setActiveTab('landing')}
          className="flex items-center gap-3 text-left hover:opacity-90 transition-opacity"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
              StudyLMS <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">AI</span>
            </h1>
            <p className="text-xs text-slate-400">NotebookLM & Quizlet Hub</p>
          </div>
        </button>
      </div>

      {/* Landing Page Link */}
      <div className="px-3 pt-3">
        <button
          onClick={() => setActiveTab('landing')}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
            activeTab === 'landing'
              ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400'
              : 'border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Home className="w-4 h-4 text-indigo-400" />
          <span>Landing Page Preview</span>
        </button>
      </div>

      {/* Main Navigation */}
      <div className="p-3 space-y-1 overflow-y-auto">
        <p className="px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Main Navigation</p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-indigo-600/90 text-white shadow-sm shadow-indigo-900/50'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="text-[9px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Notebook Selector */}
      <div className="px-3 py-2 border-t border-slate-800/80 mt-auto">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Study Notebooks ({notebooks.length})
          </span>
          <button
            onClick={() => setShowModal(true)}
            className="text-slate-400 hover:text-indigo-400 hover:bg-slate-800 p-1 rounded transition-colors"
            title="Create Notebook"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-1 max-h-28 overflow-y-auto">
          {notebooks.map((nb) => {
            const isSelected = nb.id === activeNotebookId;
            return (
              <button
                key={nb.id}
                onClick={() => setActiveNotebookId(nb.id)}
                className={`w-full text-left p-2 rounded-lg text-xs transition-all group ${
                  isSelected
                    ? 'bg-slate-800 text-white border border-slate-700 font-medium'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate">
                    <BookOpen className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-indigo-400' : 'text-slate-500'}`} />
                    <span className="truncate">{nb.title}</span>
                  </div>
                  {isSelected && <ChevronRight className="w-3 h-3 text-indigo-400 shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Streak & Stats */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/50">
        <div className="bg-slate-900/90 rounded-xl p-2.5 border border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <Flame className="w-3.5 h-3.5 fill-amber-400/20" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-200">{stats.studyStreakDays} Day Streak</div>
              <div className="text-[10px] text-slate-400">{stats.cardsMastered} cards mastered</div>
            </div>
          </div>
          <button
            onClick={onOpenAuth}
            className="text-[10px] font-bold text-indigo-400 hover:underline px-2 py-1 rounded bg-indigo-500/10 border border-indigo-500/20"
          >
            Sign In
          </button>
        </div>
      </div>

      {/* Modal to Create Notebook */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md text-white shadow-2xl">
            <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-400" /> Create Study Notebook
            </h3>
            <p className="text-xs text-slate-400 mb-4">Organize sources, flashcards, and notes by course or subject.</p>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Notebook Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Organic Chemistry II"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
                <textarea
                  placeholder="e.g. Reactions, mechanisms, and synthesis notes..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm h-20 resize-none focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow"
                >
                  Create Notebook
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
};

