import React, { useState, useEffect, useRef } from 'react';
import {
  Notebook as NotebookIcon,
  Plus,
  Trash2,
  Sparkles,
  Save,
  Check,
  Wand2,
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
  X,
  Search,
  Download,
  Upload,
  Code2,
  Tag,
  AlertCircle,
} from 'lucide-react';
import { NoteItem } from '../types';
import { runNotionAIAction, fetchNoteVersionsApi, importWorkspaceItemsApi } from '../services/api';
import {
  exportToDocx,
  exportToJson,
  exportToPrintablePdf,
  parseNotesImport,
} from '../utils/exportImport';

interface NoteVersion {
  timestamp: string;
  title: string;
  content: string;
}

interface NotesViewProps {
  notes: NoteItem[];
  activeNotebookId: string;
  onSaveNote: (note: NoteItem, saveVersion?: boolean) => Promise<void> | void;
  onDeleteNote: (id: string) => void;
  onGenerateFlashcardsFromNote: (title: string, content: string) => void;
  onGenerateQuizFromNote: (title: string, content: string) => void;
  isAuthenticated?: boolean;
}

const AI_NOTE_ACTIONS = [
  { id: 'improve', label: 'Improve' },
  { id: 'explain', label: 'Explain' },
  { id: 'summarize', label: 'Summarize' },
  { id: 'simplify', label: 'Simplify' },
  { id: 'expand', label: 'Expand' },
  { id: 'examples', label: 'Examples' },
  { id: 'fix-grammar', label: 'Fix Grammar' },
  { id: 'extract-key-terms', label: 'Key Terms' },
];

export const NotesView: React.FC<NotesViewProps> = ({
  notes,
  activeNotebookId,
  onSaveNote,
  onDeleteNote,
  onGenerateFlashcardsFromNote,
  onGenerateQuizFromNote,
  isAuthenticated = false,
}) => {
  const [activeNoteId, setActiveNoteId] = useState<string>(notes[0]?.id || '');
  const activeNote = notes.find((n) => n.id === activeNoteId) || notes[0];

  const [title, setTitle] = useState(activeNote?.title || 'New Study Note');
  const [content, setContent] = useState(activeNote?.content || '');
  const [tags, setTags] = useState<string[]>(activeNote?.tags || ['General']);
  const [tagInput, setTagInput] = useState('');
  const [noteSearch, setNoteSearch] = useState('');

  const [loadingAI, setLoadingAI] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedLabel, setLastSavedLabel] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState('');

  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<Record<string, NoteVersion[]>>({});

  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (notes.length === 0) {
      setActiveNoteId('');
      setTitle('');
      setContent('');
      setTags(['General']);
      setSaveState('idle');
      return;
    }
    const found = notes.find((n) => n.id === activeNoteId);
    if (!found) {
      setActiveNoteId(notes[0].id);
      setTitle(notes[0].title);
      setContent(notes[0].content);
      setTags(notes[0].tags || ['General']);
      setSaveState('idle');
    }
  }, [notes, activeNoteId]);

  const handleSelectNote = (note: NoteItem) => {
    setActiveNoteId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setTags(note.tags || ['General']);
    setSaveState('idle');
    setErrorMsg('');
  };

  const handleCreateNew = async () => {
    const newNote: NoteItem = {
      id: `note-${Date.now()}`,
      notebookId: activeNotebookId,
      title: 'Untitled Note',
      content: '# New Study Note\n\nType / for commands (Heading, Table, Code, Quote, Formula, Callout, Checkbox)...',
      updatedAt: new Date().toISOString(),
      tags: ['General'],
    };
    try {
      await onSaveNote(newNote, true);
      setActiveNoteId(newNote.id);
      setTitle(newNote.title);
      setContent(newNote.content);
      setTags(newNote.tags);
      setSaveState('saved');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to create note.');
      setSaveState('error');
    }
  };

  const handleSave = async (isAuto = false) => {
    if (!activeNote) return;
    setSaveState('saving');
    setErrorMsg('');
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const updated: NoteItem = {
      ...activeNote,
      notebookId: activeNote.notebookId || activeNotebookId,
      title: title || 'Untitled Note',
      content,
      tags,
      updatedAt: new Date().toISOString(),
    };

    try {
      await onSaveNote(updated, !isAuto);

      setVersions((prev) => {
        const noteVers = prev[activeNote.id] || [];
        return {
          ...prev,
          [activeNote.id]: [
            { timestamp: nowStr, title: updated.title, content: updated.content },
            ...noteVers.slice(0, 14),
          ],
        };
      });

      setLastSavedLabel(nowStr);
      setSaveState('saved');
    } catch (err: any) {
      setSaveState('error');
      setErrorMsg(err?.message || 'Failed to save note changes.');
    }
  };

  const hasUnsavedChanges =
    Boolean(activeNote) &&
    (title !== activeNote!.title ||
      content !== activeNote!.content ||
      JSON.stringify(tags) !== JSON.stringify(activeNote!.tags || []));

  useEffect(() => {
    if (hasUnsavedChanges && saveState !== 'saving' && saveState !== 'error') {
      setSaveState('dirty');
    }
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (hasUnsavedChanges && saveState !== 'saving') {
        handleSave(true);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [activeNote, title, content, tags, hasUnsavedChanges, saveState]);

  const openHistoryDrawer = async () => {
    setShowHistory(true);
    if (activeNote && isAuthenticated) {
      try {
        const remoteVersions = await fetchNoteVersionsApi(activeNote.id);
        if (remoteVersions.length > 0) {
          setVersions((prev) => ({
            ...prev,
            [activeNote.id]: remoteVersions.map((v) => ({
              timestamp: new Date(v.savedAt).toLocaleString(),
              title: v.title,
              content: v.content,
            })),
          }));
        }
      } catch {
        // retain local versions
      }
    }
  };

  const handleAIAction = async (action: string) => {
    if (!content.trim() || loadingAI) return;
    setLoadingAI(true);
    setErrorMsg('');
    try {
      const result = await runNotionAIAction(action, content, title);
      setContent((prev) => `${prev}\n\n---\n### AI (${action.toUpperCase()})\n${result}`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'AI note action failed.');
    } finally {
      setLoadingAI(false);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);

    if (val.endsWith('/')) {
      setShowSlashMenu(true);
      setSlashQuery('');
    } else if (showSlashMenu) {
      const slashIndex = val.lastIndexOf('/');
      if (slashIndex !== -1 && !val.slice(slashIndex).includes('\n')) {
        setSlashQuery(val.slice(slashIndex + 1));
      } else {
        setShowSlashMenu(false);
      }
    }
  };

  const insertBlockAtCursor = (syntax: string, replaceSlash = false) => {
    const el = textareaRef.current;
    if (!el) {
      setContent((prev) => `${prev}\n${syntax}`);
      return;
    }

    if (replaceSlash) {
      const slashIndex = content.lastIndexOf('/');
      const prefix = slashIndex !== -1 ? content.slice(0, slashIndex) : content;
      setContent(`${prefix}${syntax}`);
      setShowSlashMenu(false);
      return;
    }

    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const next = content.slice(0, start) + syntax + content.slice(end);
    setContent(next);
    setShowSlashMenu(false);
    setTimeout(() => {
      el.focus();
      const pos = start + syntax.length;
      el.setSelectionRange(pos, pos);
    }, 0);
  };

  const slashOptions = [
    { label: 'Heading', syntax: '# Heading\n', icon: Heading, desc: 'Section heading' },
    { label: 'Table', syntax: '\n| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |\n', icon: Table, desc: 'Markdown table' },
    { label: 'Code Block', syntax: '\n```python\n# code snippet\n```\n', icon: Code2, desc: 'Syntax-fenced code' },
    { label: 'Quote', syntax: '> "Insert key quote or definition here."\n', icon: Quote, desc: 'Blockquote' },
    { label: 'Formula', syntax: '\n$$ E = m \\cdot c^2 $$\n', icon: Calculator, desc: 'Math LaTeX expression' },
    { label: 'Callout', syntax: '> **Note:** Highlight important reminder here.\n', icon: MessageSquareQuote, desc: 'Callout box' },
    { label: 'Checkbox', syntax: '- [ ] Complete review of chapter\n', icon: CheckSquare, desc: 'Checklist task' },
    { label: 'Image', syntax: '![Study diagram](https://images.unsplash.com/photo-1516321318423-f06f85e504b3)\n', icon: ImageIcon, desc: 'Markdown image' },
  ].filter((opt) => opt.label.toLowerCase().includes(slashQuery.toLowerCase()));

  const handleRestoreVersion = async (ver: NoteVersion) => {
    setTitle(ver.title);
    setContent(ver.content);
    setShowHistory(false);
    if (activeNote) {
      await onSaveNote(
        {
          ...activeNote,
          title: ver.title,
          content: ver.content,
          tags,
          updatedAt: new Date().toISOString(),
        },
        true
      );
      setSaveState('saved');
    }
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = tagInput.trim();
    if (!cleaned || tags.includes(cleaned)) return;
    setTags((prev) => [...prev, cleaned]);
    setTagInput('');
  };

  const handleExportMarkdown = () => {
    if (!activeNote) return;
    const blob = new Blob([`# ${title}\n\n${content}`], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(title || 'study_note').replace(/[^a-z0-9-_]+/gi, '_')}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportNoteFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorMsg('');
    try {
      const text = await file.text();
      const parsed = parseNotesImport(file.name, text);
      if (parsed.length === 0) {
        setErrorMsg('No readable note content found in the imported file.');
        return;
      }
      if (isAuthenticated) {
        const res = await importWorkspaceItemsApi({
          kind: 'notes',
          notebookId: activeNotebookId,
          notes: parsed,
        });
        if (res.notes?.[0]) {
          await onSaveNote(res.notes[0], false);
        }
      } else {
        for (const item of parsed) {
          await onSaveNote(
            {
              id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              notebookId: activeNotebookId,
              title: item.title,
              content: item.content,
              tags: item.tags || ['imported'],
              updatedAt: new Date().toISOString(),
            },
            true
          );
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to import note file.');
    }
  };

  const filteredNotes = notes.filter((n) => {
    if (!noteSearch.trim()) return true;
    const q = noteSearch.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      (n.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Notes List Sidebar */}
      <div className="w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full shrink-0">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <NotebookIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Smart Notes</h3>
            </div>
            <div className="flex items-center gap-1">
              <label
                title="Import .md, .txt, or .json note"
                className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-pointer transition-colors"
              >
                <Upload className="w-4 h-4" />
                <input
                  type="file"
                  accept=".md,.markdown,.txt,.json"
                  className="hidden"
                  onChange={handleImportNoteFile}
                />
              </label>
              <button
                onClick={handleCreateNew}
                className="p-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors"
                title="Create Note"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              value={noteSearch}
              onChange={(e) => setNoteSearch(e.target.value)}
              placeholder="Search notes or tags..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {filteredNotes.length === 0 ? (
            <div className="text-center py-8 px-3 text-xs text-slate-400">
              {notes.length === 0 ? 'No notes in this notebook yet. Click + to create one.' : 'No matching notes.'}
            </div>
          ) : (
            filteredNotes.map((n) => {
              const isSelected = n.id === (activeNote?.id || activeNoteId);
              return (
                <div
                  key={n.id}
                  className={`w-full text-left p-3 rounded-xl transition-all border group flex items-start justify-between gap-2 ${
                    isSelected
                      ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 shadow-2xs'
                      : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <button onClick={() => handleSelectNote(n)} className="flex-1 text-left min-w-0">
                    <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate mb-1">
                      {n.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                      {n.content.replace(/[#*`]/g, '')}
                    </p>
                    {n.tags && n.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {n.tags.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                  <button
                    onClick={() => onDeleteNote(n.id)}
                    title="Delete Note"
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Note Editor Area */}
      {activeNote ? (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden relative">
          {/* AI Actions + Save Status Header */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 overflow-x-auto py-0.5">
              <span className="text-[11px] font-bold uppercase text-slate-400 mr-1 flex items-center gap-1 shrink-0">
                <Wand2 className="w-3.5 h-3.5 text-indigo-500" /> AI:
              </span>
              {AI_NOTE_ACTIONS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => handleAIAction(a.id)}
                  disabled={loadingAI}
                  className="text-[11px] font-semibold bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-lg text-slate-700 dark:text-slate-300 transition-colors shrink-0"
                >
                  {a.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {/* Honest Save Status */}
              {saveState === 'saving' && (
                <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-md">
                  Saving...
                </span>
              )}
              {saveState === 'dirty' && (
                <span className="text-[10px] text-amber-500 bg-amber-500/10 px-2 py-1 rounded-md">
                  Unsaved changes
                </span>
              )}
              {saveState === 'error' && (
                <span className="text-[10px] text-rose-500 bg-rose-500/10 px-2 py-1 rounded-md flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Save failed
                </span>
              )}
              {saveState === 'saved' && lastSavedLabel && (
                <span className="text-[10px] text-emerald-500 flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-md">
                  <Clock className="w-3 h-3" /> Saved {lastSavedLabel}
                </span>
              )}

              <button
                onClick={openHistoryDrawer}
                className="text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-2.5 py-1.5 rounded-lg flex items-center gap-1"
              >
                <History className="w-3.5 h-3.5" /> History
              </button>

              <button
                onClick={handleExportMarkdown}
                className="text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-2.5 py-1.5 rounded-lg flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" /> .md
              </button>

              <button
                type="button"
                onClick={() =>
                  exportToDocx(title || 'study_note', title || 'Study Note', [
                    { heading: tags.length ? `Tags: ${tags.join(', ')}` : undefined, body: content },
                  ])
                }
                className="text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1.5 rounded-lg"
              >
                DOCX
              </button>

              <button
                type="button"
                onClick={() =>
                  exportToPrintablePdf(title || 'Study Note', [
                    { heading: tags.length ? `Tags: ${tags.join(', ')}` : undefined, body: content },
                  ])
                }
                className="text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1.5 rounded-lg"
              >
                PDF
              </button>

              <button
                type="button"
                onClick={() =>
                  exportToJson(title || 'study_note', {
                    ...activeNote,
                    title,
                    content,
                    tags,
                  })
                }
                className="text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1.5 rounded-lg"
              >
                JSON
              </button>

              <button
                onClick={() => onGenerateFlashcardsFromNote(title, content)}
                className="text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-2.5 py-1.5 rounded-lg flex items-center gap-1 hover:bg-amber-100"
              >
                <Layers className="w-3.5 h-3.5" /> Flashcards
              </button>

              <button
                onClick={() => onGenerateQuizFromNote(title, content)}
                className="text-xs font-semibold bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800 px-2.5 py-1.5 rounded-lg flex items-center gap-1 hover:bg-pink-100"
              >
                <HelpCircle className="w-3.5 h-3.5" /> Quiz
              </button>

              <button
                onClick={() => handleSave(false)}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1"
              >
                {saveState === 'saved' ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                <span>Save</span>
              </button>
            </div>
          </div>

          {/* Visible Block Formatting Toolbar */}
          <div className="px-4 py-1.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1 overflow-x-auto bg-white dark:bg-slate-900">
            <span className="text-[10px] font-bold uppercase text-slate-400 mr-1">Insert Block:</span>
            {slashOptions.map((opt) => {
              const IconComp = opt.icon;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => insertBlockAtCursor(opt.syntax, false)}
                  className="px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1 shrink-0"
                >
                  <IconComp className="w-3 h-3 text-emerald-500" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>

          <div className="p-6 flex-1 flex flex-col overflow-y-auto space-y-4 relative">
            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl">
                {errorMsg}
              </div>
            )}

            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note Title..."
              className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 bg-transparent border-none focus:outline-none placeholder-slate-400"
            />

            {/* Tags Editor */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => setTags((prev) => prev.filter((item) => item !== t))}
                    className="hover:text-rose-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <form onSubmit={handleAddTag} className="inline-flex items-center">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="+ Add tag"
                  className="bg-transparent border-b border-slate-200 dark:border-slate-700 text-[11px] px-1.5 py-0.5 w-24 focus:outline-none focus:border-emerald-500"
                />
              </form>
            </div>

            {loadingAI && (
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs rounded-xl flex items-center gap-2">
                <Sparkles className="w-4 h-4 animate-spin shrink-0" />
                <span>AI is formatting your note content...</span>
              </div>
            )}

            <div className="relative flex-1 flex flex-col">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={handleTextareaChange}
                placeholder="Type / for slash commands (Heading, Table, Code, Quote, Formula, Callout, Checkbox)..."
                className="flex-1 w-full bg-transparent border-none resize-none font-mono text-xs text-slate-800 dark:text-slate-200 focus:outline-none leading-relaxed"
              />

              {showSlashMenu && (
                <div className="absolute bottom-12 left-4 w-64 bg-slate-900 text-white border border-slate-700 rounded-2xl shadow-2xl p-2 z-50">
                  <div className="text-[10px] font-bold uppercase text-slate-400 px-2.5 py-1 border-b border-slate-800 mb-1 flex items-center justify-between">
                    <span>Slash Commands</span>
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
                          onClick={() => insertBlockAtCursor(opt.syntax, true)}
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
                    Restore any saved snapshot of this note.
                  </p>

                  <div className="space-y-2">
                    {(versions[activeNote.id] || []).map((ver, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block">
                            Saved {ver.timestamp}
                          </span>
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                            {ver.title}
                          </h4>
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
                        Click Save to create a restore snapshot.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs gap-3">
          <p>No study notes in this notebook yet.</p>
          <button
            onClick={handleCreateNew}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold"
          >
            Create First Note
          </button>
        </div>
      )}
    </div>
  );
};
