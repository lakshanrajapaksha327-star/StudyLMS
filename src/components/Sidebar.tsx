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
  Flame,
  ChevronRight,
  GraduationCap,
  History,
  Settings,
  ShieldCheck,
  Home,
  Wand2,
  LogOut,
  LogIn,
  Trash2,
  Edit3,
  Search,
  AlertTriangle,
  X,
  Brain,
  Network,
  Mic,
  BarChart3,
} from 'lucide-react';
import { ActiveTab, Notebook, StudyStats, UserProfile, SourceDocument, NoteItem } from '../types';

const NOTEBOOK_COLORS = [
  { label: 'Indigo', value: 'from-indigo-600 to-purple-600', dot: 'bg-indigo-500' },
  { label: 'Emerald', value: 'from-emerald-600 to-teal-600', dot: 'bg-emerald-500' },
  { label: 'Amber', value: 'from-amber-500 to-orange-600', dot: 'bg-amber-500' },
  { label: 'Rose', value: 'from-rose-600 to-pink-600', dot: 'bg-rose-500' },
  { label: 'Cyan', value: 'from-cyan-600 to-blue-600', dot: 'bg-cyan-500' },
];

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  notebooks: Notebook[];
  activeNotebookId: string;
  setActiveNotebookId: (id: string) => void;
  onCreateNotebook: (title: string, description: string, color?: string) => void;
  onUpdateNotebook?: (notebook: Notebook) => void;
  onDeleteNotebook?: (id: string, cascade?: boolean) => void;
  sources?: SourceDocument[];
  notes?: NoteItem[];
  stats: StudyStats;
  userProfile?: UserProfile;
  isAuthenticated?: boolean;
  isDemoMode?: boolean;
  isAdmin?: boolean;
  onOpenAuth: () => void;
  onSignOut?: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  notebooks,
  activeNotebookId,
  setActiveNotebookId,
  onCreateNotebook,
  onUpdateNotebook,
  onDeleteNotebook,
  sources = [],
  notes = [],
  stats,
  userProfile,
  isAuthenticated = false,
  isDemoMode = false,
  isAdmin = false,
  onOpenAuth,
  onSignOut,
  mobileOpen = false,
  onMobileClose,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingNotebook, setEditingNotebook] = useState<Notebook | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newColor, setNewColor] = useState(NOTEBOOK_COLORS[0].value);
  const [nbFilter, setNbFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Notebook | null>(null);

  const openCreateModal = () => {
    setEditingNotebook(null);
    setNewTitle('');
    setNewDesc('');
    setNewColor(NOTEBOOK_COLORS[0].value);
    setShowModal(true);
  };

  const openEditModal = (nb: Notebook, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNotebook(nb);
    setNewTitle(nb.title);
    setNewDesc(nb.description || '');
    setNewColor(nb.color || NOTEBOOK_COLORS[0].value);
    setShowModal(true);
  };

  const handleSaveNotebookForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    if (editingNotebook && onUpdateNotebook) {
      onUpdateNotebook({
        ...editingNotebook,
        title: newTitle.trim(),
        description: newDesc.trim() || 'AI study workspace',
        color: newColor,
        updatedAt: new Date().toISOString().split('T')[0],
      });
    } else {
      onCreateNotebook(newTitle.trim(), newDesc.trim() || 'AI study workspace', newColor);
    }
    setNewTitle('');
    setNewDesc('');
    setEditingNotebook(null);
    setShowModal(false);
  };

  const navItems: Array<{ id: ActiveTab; label: string; icon: any; badge?: string }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'planner', label: 'AI Study Planner', icon: Calendar },
    { id: 'adaptive', label: 'Adaptive & Revision', icon: Brain, badge: 'New' },
    { id: 'examprep', label: 'Exam Prep Studio', icon: GraduationCap, badge: 'New' },
    { id: 'notebooklm', label: 'Document Library', icon: FileText, badge: 'Sources' },
    { id: 'chat', label: 'ChatGPT Tutor', icon: MessageSquareText },
    { id: 'summary', label: 'Summary Page', icon: FileText },
    { id: 'notes', label: 'Notion AI Notes', icon: NotebookIcon },
    { id: 'visuals', label: 'Visual Studio', icon: Network, badge: 'New' },
    { id: 'audio', label: 'Audio Lectures', icon: Mic, badge: 'New' },
    { id: 'flashcards', label: 'Quizlet Flashcards', icon: Layers },
    { id: 'quiz', label: 'Practice Quizzes', icon: HelpCircle },
    { id: 'analytics', label: 'Learning Analytics', icon: BarChart3, badge: 'New' },
    { id: 'toolkit', label: 'AI STEM Toolkit', icon: Wand2, badge: 'Pro' },
    { id: 'history', label: 'Activity History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  if (isAdmin || userProfile?.role === 'Admin') {
    navItems.push({ id: 'admin', label: 'Admin Panel', icon: ShieldCheck, badge: 'Admin' });
  }

  const filteredNotebooks = nbFilter.trim()
    ? notebooks.filter((nb) => nb.title.toLowerCase().includes(nbFilter.toLowerCase()))
    : notebooks;

  const getColorDot = (colorVal?: string) => {
    const match = NOTEBOOK_COLORS.find((c) => c.value === colorVal);
    return match?.dot || 'bg-indigo-500';
  };

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    onMobileClose?.();
  };

  return (
    <>
      {mobileOpen && (
        <div
          aria-hidden="true"
          onClick={onMobileClose}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-30 lg:hidden"
        />
      )}
      <aside
        aria-label="Primary Workspace Sidebar"
        className={`w-64 bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800 h-screen select-none z-40 transition-transform duration-200 ${
          mobileOpen
            ? 'fixed inset-y-0 left-0 translate-x-0 shadow-2xl'
            : 'fixed inset-y-0 left-0 -translate-x-full lg:sticky lg:top-0 lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <button
            onClick={() => handleSelectTab('landing')}
            className="flex items-center gap-3 text-left hover:opacity-90 transition-opacity"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                StudyLMS{' '}
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  AI
                </span>
              </h1>
              <p className="text-xs text-slate-400">NotebookLM & Quizlet Hub</p>
            </div>
          </button>
          {onMobileClose && (
            <button
              type="button"
              onClick={onMobileClose}
              aria-label="Close navigation menu"
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Landing Page Link */}
        <div className="px-3 pt-3">
          <button
            onClick={() => handleSelectTab('landing')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
              activeTab === 'landing'
                ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400'
                : 'border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Home className="w-4 h-4 text-indigo-400" />
            <span>Landing Page</span>
          </button>
        </div>

        {/* Main Navigation */}
        <div className="p-3 space-y-1 overflow-y-auto flex-1">
          <p className="px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Main Navigation
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
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
      <div className="px-3 py-2 border-t border-slate-800/80">
        <div className="flex items-center justify-between px-2 mb-1.5">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Study Notebooks ({notebooks.length})
          </span>
          <button
            onClick={openCreateModal}
            className="text-slate-400 hover:text-indigo-400 hover:bg-slate-800 p-1 rounded transition-colors"
            title="Create Notebook"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {notebooks.length > 3 && (
          <div className="relative mb-1.5 px-1">
            <Search className="w-3 h-3 text-slate-500 absolute left-3 top-2" />
            <input
              type="text"
              value={nbFilter}
              onChange={(e) => setNbFilter(e.target.value)}
              placeholder="Filter notebooks..."
              className="w-full bg-slate-800/70 border border-slate-700/70 rounded-lg pl-7 pr-2 py-1 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}

        <div className="space-y-1 max-h-36 overflow-y-auto">
          {filteredNotebooks.map((nb) => {
            const isSelected = nb.id === activeNotebookId;
            const docCount = sources.filter((s) => s.notebookId === nb.id).length;
            const noteCount = notes.filter((n) => n.notebookId === nb.id).length;
            return (
              <div
                key={nb.id}
                className={`w-full text-left p-2 rounded-lg text-xs transition-all group flex items-center justify-between gap-1 ${
                  isSelected
                    ? 'bg-slate-800 text-white border border-slate-700 font-medium'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <button
                  onClick={() => setActiveNotebookId(nb.id)}
                  className="flex items-center gap-2 truncate flex-1 text-left min-w-0"
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${getColorDot(nb.color)}`} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate leading-tight">{nb.title}</div>
                    <div className="text-[9px] text-slate-500 truncate">
                      {docCount} docs • {noteCount} notes
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-0.5 shrink-0">
                  {onUpdateNotebook && (
                    <button
                      onClick={(e) => openEditModal(nb, e)}
                      title="Edit notebook"
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 hover:text-indigo-400 transition-opacity"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  )}
                  {notebooks.length > 1 && onDeleteNotebook && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(nb);
                      }}
                      title="Delete notebook"
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 hover:text-rose-400 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                  {isSelected && <ChevronRight className="w-3 h-3 text-indigo-400 shrink-0" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer User & Streak */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/50 space-y-2">
        <div className="bg-slate-900/90 rounded-xl p-2.5 border border-slate-800/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <Flame className="w-3.5 h-3.5 fill-amber-400/20" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-200 truncate">
                {isAuthenticated ? userProfile?.name || 'Student' : isDemoMode ? 'Demo Workspace' : 'Guest'}
              </div>
              <div className="text-[10px] text-slate-400">
                {stats.studyStreakDays}d streak • {stats.cardsMastered} mastered
              </div>
            </div>
          </div>

          {isAuthenticated ? (
            <button
              onClick={onSignOut}
              title="Sign Out"
              className="text-[10px] font-bold text-slate-300 hover:text-rose-300 px-2 py-1 rounded bg-slate-800 border border-slate-700 flex items-center gap-1 shrink-0"
            >
              <LogOut className="w-3 h-3" />
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="text-[10px] font-bold text-indigo-400 hover:underline px-2 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-1 shrink-0"
            >
              <LogIn className="w-3 h-3" /> Sign In
            </button>
          )}
        </div>
      </div>

      {/* Modal to Create / Edit Notebook */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md text-white shadow-2xl">
            <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-400" />
              {editingNotebook ? 'Edit Study Notebook' : 'Create Study Notebook'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Organize sources, flashcards, and notes by course or subject.
            </p>
            <form onSubmit={handleSaveNotebookForm} className="space-y-4">
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
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Theme Accent</label>
                <div className="flex items-center gap-2">
                  {NOTEBOOK_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setNewColor(c.value)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1.5 ${
                        newColor === c.value
                          ? 'bg-slate-800 border-indigo-400 text-white'
                          : 'bg-slate-800/40 border-slate-700 text-slate-400'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingNotebook(null);
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow"
                >
                  {editingNotebook ? 'Save Changes' : 'Create Notebook'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Notebook Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2 text-rose-400">
                <AlertTriangle className="w-5 h-5" /> Delete "{deleteTarget.title}"?
              </h3>
              <button onClick={() => setDeleteTarget(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Choose whether to safely move this notebook's documents, notes, flashcards, and quizzes into another notebook, or permanently delete everything inside it.
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => {
                  onDeleteNotebook?.(deleteTarget.id, false);
                  setDeleteTarget(null);
                }}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl"
              >
                Move Items to Another Notebook & Delete Empty Notebook
              </button>
              <button
                onClick={() => {
                  onDeleteNotebook?.(deleteTarget.id, true);
                  setDeleteTarget(null);
                }}
                className="w-full py-2.5 px-4 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-xs font-bold rounded-xl"
              >
                Permanently Delete Notebook & All Its Contents
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                className="w-full py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
    </>
  );
};
