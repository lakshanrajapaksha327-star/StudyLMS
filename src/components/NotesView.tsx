import React, { useState, useEffect, useRef } from 'react';
import {
  Notebook as NotebookIcon,
  Plus,
  Trash2,
  Sparkles,
  Save,
  Check,
  Tag,
  Wand2,
  FileText,
  Copy,
  Layers,
  HelpCircle,
  History,
  Clock,
  RotateCcw,
  Heading,
  Table,
  Quote,
  Calculator,
  Image as ImageIcon,
  CheckSquare,
  MessageSquareQuote,
  X
} from 'lucide-react';
import { NoteItem } from '../types';
import { runNotionAIAction } from '../services/api';

interface NoteVersion {
  timestamp: string;
  title: string;
  content: string;
}

interface NotesViewProps {
  notes: NoteItem[];
  onSaveNote: (note: NoteItem) => void;
  onDeleteNote: (id: string) => void;
  onGenerateFlashcardsFromNote: (title: string, content: string) => void;
  onGenerateQuizFromNote: (title: string, content: string) => void;
}

export const NotesView: React.FC<NotesViewProps> = ({
  notes,
  onSaveNote,
  onDeleteNote,
  onGenerateFlashcardsFromNote,
  onGenerateQuizFromNote,
}) => {
  const [activeNoteId, setActiveNoteId] = useState<string>(notes[0]?.id || '');
  const activeNote = notes.find((n) => n.id === activeNoteId) || notes[0];

  const [title, setTitle] = useState(activeNote?.title || 'New Study Note');
  const [content, setContent] = useState(activeNote?.content || '');
  const [loadingAI, setLoadingAI] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [autoSaveTime, setAutoSaveTime] = useState<string>('');

  // Version history state
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<Record<string, NoteVersion[]>>({});

  // Slash commands menu state
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync state when active note selection changes
  const handleSelectNote = (note: NoteItem) => {
    setActiveNoteId(note.id);
    setTitle(note.title);
    setContent(note.content);
  };

  const handleCreateNew = () => {
    const newNote: NoteItem = {
      id: `note-${Date.now()}`,
      notebookId: 'nb-1',
      title: 'Untitled Note',
      content: '# New Study Note\n\nType / for commands (Heading, Table, Quote, Formula, Callout, Checkbox)...',
      updatedAt: 'Just now',
      tags: ['General'],
    };
    onSaveNote(newNote);
    setActiveNoteId(newNote.id);
    setTitle(newNote.title);
    setContent(newNote.content);
  };

  const handleSave = (isAuto = false) => {
    if (!activeNote) return;
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const updated: NoteItem = {
      ...activeNote,
      title: title || 'Untitled Note',
      content,
      updatedAt: nowStr,
    };
    onSaveNote(updated);

    // Record version history
    setVersions((prev) => {
      const noteVers = prev[activeNote.id] || [];
      return {
        ...prev,
        [activeNote.id]: [
          { timestamp: nowStr, title, content },
          ...noteVers.slice(0, 9), // keep last 10 versions
        ],
      };
    });

    if (isAuto) {
      setAutoSaveTime(nowStr);
    } else {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    }
  };

  // Auto-save timer every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeNote && (title !== activeNote.title || content !== activeNote.content)) {
        handleSave(true);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [activeNote, title, content]);

  const handleAIAction = async (action: string) => {
    if (!content.trim() || loadingAI) return;
    setLoadingAI(true);
    try {
      const result = await runNotionAIAction(action, content, title);
      setContent((prev) => `${prev}\n\n---\n### 🤖 Notion AI (${action.toUpperCase()})\n${result}`);
      handleSave();
    } catch (err) {
      console.error('Notion AI error:', err);
    } finally {
      setLoadingAI(false);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);

    // Detect slash key for slash commands menu
    if (val.endsWith('/')) {
      setShowSlashMenu(true);
      setSlashQuery('');
    } else if (showSlashMenu) {
      const slashIndex = val.lastIndexOf('/');
      if (slashIndex !== -1) {
        setSlashQuery(val.slice(slashIndex + 1));
      } else {
        setShowSlashMenu(false);
      }
    }
  };

  const insertCommand = (syntax: string) => {
    if (!textareaRef.current) return;
    const val = content;
    const slashIndex = val.lastIndexOf('/');
    const prefix = slashIndex !== -1 ? val.slice(0, slashIndex) : val;
    setContent(`${prefix}${syntax}`);
    setShowSlashMenu(false);
  };

  const slashOptions = [
    { label: 'Heading 1', syntax: '# Heading 1\n', icon: Heading, desc: 'Large title section' },
    { label: 'Table', syntax: '\n| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |\n', icon: Table, desc: '3x2 markdown table' },
    { label: 'Quote', syntax: '> "Insert inspiring quote or key definition here."\n', icon: Quote, desc: 'Blockquote formatting' },
    { label: 'Formula', syntax: '$$ E = m \\cdot c^2 $$\n', icon: Calculator, desc: 'Math LaTeX expression' },
    { label: 'Callout', syntax: '> 💡 **Note:** Highlight important study reminder here.\n', icon: MessageSquareQuote, desc: 'Visual callout box' },
    { label: 'Checkbox', syntax: '- [ ] Complete review of Chapter 3\n', icon: CheckSquare, desc: 'To-do item checkbox' },
    { label: 'Image', syntax: '![Study diagram](https://images.unsplash.com/photo-1516321318423-f06f85e504b3)\n', icon: ImageIcon, desc: 'Embedded image link' },
  ].filter((opt) => opt.label.toLowerCase().includes(slashQuery.toLowerCase()));

  const handleRestoreVersion = (ver: NoteVersion) => {
    setTitle(ver.title);
    setContent(ver.content);
    setShowHistory(false);
    handleSave();
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Notes List Sidebar */}
      <div className="w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full shrink-0">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <NotebookIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Notion AI Notes</h3>
          </div>
          <button
            onClick={handleCreateNew}
            className="p-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors"
            title="Create Note"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {notes.map((n) => {
            const isSelected = n.id === activeNoteId;
            return (
              <button
                key={n.id}
                onClick={() => handleSelectNote(n)}
                className={`w-full text-left p-3 rounded-xl transition-all border ${
                  isSelected
                    ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 shadow-2xs'
                    : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate mb-1">
                  {n.title}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                  {n.content.replace(/[#*`]/g, '')}
                </p>
                <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
                  <span>Updated {n.updatedAt}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Note Editor Area */}
      {activeNote ? (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden relative">
          {/* Top Notion AI Toolbar */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              <span className="text-[11px] font-bold uppercase text-slate-400 mr-1 flex items-center gap-1">
                <Wand2 className="w-3.5 h-3.5 text-indigo-500" /> Notion AI:
              </span>

              <button
                onClick={() => handleAIAction('summarize')}
                disabled={loadingAI}
                className="text-[11px] font-semibold bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg text-slate-700 dark:text-slate-300 transition-colors"
              >
                📝 Summarize
              </button>

              <button
                onClick={() => handleAIAction('expand')}
                disabled={loadingAI}
                className="text-[11px] font-semibold bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg text-slate-700 dark:text-slate-300 transition-colors"
              >
                ✨ Expand Details
              </button>

              <button
                onClick={() => handleAIAction('extract-key-terms')}
                disabled={loadingAI}
                className="text-[11px] font-semibold bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg text-slate-700 dark:text-slate-300 transition-colors"
              >
                📐 Extract Formulas
              </button>

              <button
                onClick={() => handleAIAction('fix-grammar')}
                disabled={loadingAI}
                className="text-[11px] font-semibold bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg text-slate-700 dark:text-slate-300 transition-colors"
              >
                ✨ Fix Formatting
              </button>
            </div>

            {/* Conversions, Version History & Auto-save */}
            <div className="flex items-center gap-2">
              {autoSaveTime && (
                <span className="text-[10px] text-slate-400 flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                  <Clock className="w-3 h-3 text-emerald-500" /> Saved {autoSaveTime}
                </span>
              )}

              <button
                onClick={() => setShowHistory(true)}
                className="text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-2.5 py-1.5 rounded-lg flex items-center gap-1"
                title="Version History"
              >
                <History className="w-3.5 h-3.5" />
                <span>History</span>
              </button>

              <button
                onClick={() => onGenerateFlashcardsFromNote(title, content)}
                className="text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-amber-100"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>To Flashcards</span>
              </button>

              <button
                onClick={() => onGenerateQuizFromNote(title, content)}
                className="text-xs font-semibold bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-pink-100"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>To Quiz</span>
              </button>

              <button
                onClick={() => handleSave(false)}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1"
              >
                {savedSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                <span>{savedSuccess ? 'Saved' : 'Save'}</span>
              </button>
            </div>
          </div>

          {/* Title and Body inputs */}
          <div className="p-6 flex-1 flex flex-col overflow-y-auto space-y-4 relative">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note Title..."
              className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 bg-transparent border-none focus:outline-none placeholder-slate-400"
            />

            {loadingAI && (
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs rounded-xl flex items-center gap-2">
                <Sparkles className="w-4 h-4 animate-spin shrink-0" />
                <span>Notion AI is processing your note content...</span>
              </div>
            )}

            <div className="relative flex-1 flex flex-col">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={handleTextareaChange}
                placeholder="Type / for slash commands (Heading, Table, Quote, Formula, Callout, Checkbox)..."
                className="flex-1 w-full bg-transparent border-none resize-none font-mono text-xs text-slate-800 dark:text-slate-200 focus:outline-none leading-relaxed"
              />

              {/* Slash Commands Dropdown Menu */}
              {showSlashMenu && (
                <div className="absolute bottom-12 left-4 w-64 bg-slate-900 text-white border border-slate-700 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="text-[10px] font-bold uppercase text-slate-400 px-2.5 py-1 border-b border-slate-800 mb-1 flex items-center justify-between">
                    <span>Notion Slash Commands</span>
                    <button onClick={() => setShowSlashMenu(false)} className="text-slate-400 hover:text-white">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="space-y-0.5 max-h-52 overflow-y-auto">
                    {slashOptions.map((opt) => {
                      const IconComp = opt.icon;
                      return (
                        <button
                          key={opt.label}
                          onClick={() => insertCommand(opt.syntax)}
                          className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-indigo-600/30 flex items-center gap-2.5 transition-colors group"
                        >
                          <div className="w-6 h-6 rounded-lg bg-slate-800 group-hover:bg-indigo-600 flex items-center justify-center text-indigo-400 group-hover:text-white">
                            <IconComp className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-100">{opt.label}</div>
                            <div className="text-[10px] text-slate-400">{opt.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Version History Drawer Modal */}
          {showHistory && (
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex justify-end">
              <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full p-6 overflow-y-auto border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                    <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <History className="w-5 h-5 text-indigo-500" /> Version History
                    </h3>
                    <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-500">
                    Snapshots automatically taken on save and edits. Click to restore any previous version.
                  </p>

                  <div className="space-y-2">
                    {(versions[activeNote.id] || []).map((ver, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2"
                      >
                        <div>
                          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block">
                            Saved at {ver.timestamp}
                          </span>
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{ver.title}</h4>
                        </div>
                        <button
                          onClick={() => handleRestoreVersion(ver)}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1 shrink-0"
                        >
                          <RotateCcw className="w-3 h-3" /> Restore
                        </button>
                      </div>
                    ))}

                    {(!versions[activeNote.id] || versions[activeNote.id].length === 0) && (
                      <div className="text-center py-8 text-xs text-slate-400">
                        No previous versions saved yet. Auto-saves generate snapshots automatically.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
          Select or create a study note to edit.
        </div>
      )}
    </div>
  );
};

