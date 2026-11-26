import React, { useState, useEffect } from 'react';
import {
  Search,
  X,
  FileText,
  Notebook as NotebookIcon,
  Layers,
  HelpCircle,
  MessageSquareText,
  ArrowRight,
  BookOpen,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  SourceDocument,
  NoteItem,
  FlashcardSet,
  QuizSet,
  ActiveTab,
  Notebook,
  DocumentCitation,
} from '../types';
import { fetchGlobalSearchApi, fetchRecentSearches } from '../services/api';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  notebooks?: Notebook[];
  sources: SourceDocument[];
  notes: NoteItem[];
  flashcardSets: FlashcardSet[];
  quizSets: QuizSet[];
  isAuthenticated?: boolean;
  onSelectNotebook?: (notebookId: string) => void;
  onOpenCitation?: (citation: DocumentCitation) => void;
  onNavigate: (tab: ActiveTab) => void;
}

type SearchCategory =
  | 'all'
  | 'notebooks'
  | 'documents'
  | 'chunks'
  | 'notes'
  | 'flashcards'
  | 'quizzes'
  | 'chats';

interface RemoteHit {
  id: string;
  category: 'notebook' | 'document' | 'chunk' | 'note' | 'flashcard' | 'quiz' | 'chat';
  title: string;
  snippet: string;
  notebookId?: string;
  documentId?: string;
  meta?: string;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  notebooks = [],
  sources,
  notes,
  flashcardSets,
  quizSets,
  isAuthenticated = false,
  onSelectNotebook,
  onOpenCitation,
  onNavigate,
}) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SearchCategory>('all');
  const [remoteResults, setRemoteResults] = useState<RemoteHit[] | null>(null);
  const [recentSearches, setRecentSearches] = useState<
    Array<{ id: string; keyword: string; category: string }>
  >([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    if (!isOpen || !isAuthenticated) return;
    fetchRecentSearches()
      .then((list) => setRecentSearches(list || []))
      .catch(() => {});
  }, [isOpen, isAuthenticated]);

  useEffect(() => {
    if (!isOpen) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setRemoteResults(null);
      setSearchError('');
      return;
    }

    if (!isAuthenticated) {
      setRemoteResults(null);
      return;
    }

    const handle = setTimeout(async () => {
      setSearching(true);
      setSearchError('');
      try {
        const res = await fetchGlobalSearchApi(trimmed, category);
        setRemoteResults(res.results || []);
        if (Array.isArray(res.recentSearches)) {
          setRecentSearches(res.recentSearches);
        }
      } catch (err: any) {
        setSearchError(err?.message || 'Search failed.');
      } finally {
        setSearching(false);
      }
    }, 260);

    return () => clearTimeout(handle);
  }, [query, category, isOpen, isAuthenticated]);

  if (!isOpen) return null;

  const cleanQuery = query.toLowerCase().trim();

  const highlightMatch = (text: string) => {
    if (!cleanQuery || !text) return text;
    const idx = text.toLowerCase().indexOf(cleanQuery);
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-amber-400/30 text-amber-900 dark:text-amber-200 px-0.5 rounded">
          {text.slice(idx, idx + cleanQuery.length)}
        </mark>
        {text.slice(idx + cleanQuery.length)}
      </>
    );
  };

  // Local fallback search for Demo Mode
  const localHits: RemoteHit[] = [];
  if (!isAuthenticated && cleanQuery) {
    if (category === 'all' || category === 'notebooks') {
      notebooks
        .filter((nb) => nb.title.toLowerCase().includes(cleanQuery) || nb.description?.toLowerCase().includes(cleanQuery))
        .forEach((nb) =>
          localHits.push({
            id: nb.id,
            category: 'notebook',
            title: nb.title,
            snippet: nb.description || 'Study notebook',
            notebookId: nb.id,
          })
        );
    }
    if (category === 'all' || category === 'documents' || category === 'chunks') {
      sources
        .filter((s) => s.title.toLowerCase().includes(cleanQuery) || s.content.toLowerCase().includes(cleanQuery))
        .forEach((s) =>
          localHits.push({
            id: s.id,
            category: 'document',
            title: s.title,
            snippet: s.summary || s.content.slice(0, 140),
            notebookId: s.notebookId,
            documentId: s.id,
            meta: s.type.toUpperCase(),
          })
        );
    }
    if (category === 'all' || category === 'notes') {
      notes
        .filter((n) => n.title.toLowerCase().includes(cleanQuery) || n.content.toLowerCase().includes(cleanQuery))
        .forEach((n) =>
          localHits.push({
            id: n.id,
            category: 'note',
            title: n.title,
            snippet: n.content.slice(0, 140),
            notebookId: n.notebookId,
          })
        );
    }
    if (category === 'all' || category === 'flashcards') {
      flashcardSets
        .filter(
          (fc) =>
            fc.title.toLowerCase().includes(cleanQuery) ||
            fc.cards.some(
              (c) => c.question.toLowerCase().includes(cleanQuery) || c.answer.toLowerCase().includes(cleanQuery)
            )
        )
        .forEach((fc) =>
          localHits.push({
            id: fc.id,
            category: 'flashcard',
            title: fc.title,
            snippet: `${fc.cards.length} flashcards in deck`,
            notebookId: fc.notebookId,
          })
        );
    }
    if (category === 'all' || category === 'quizzes') {
      quizSets
        .filter(
          (qz) =>
            qz.title.toLowerCase().includes(cleanQuery) ||
            qz.questions.some((q) => q.question.toLowerCase().includes(cleanQuery))
        )
        .forEach((qz) =>
          localHits.push({
            id: qz.id,
            category: 'quiz',
            title: qz.title,
            snippet: `${qz.questions.length} practice questions`,
            notebookId: qz.notebookId,
          })
        );
    }
  }

  const hits = isAuthenticated ? remoteResults || [] : localHits;

  const handleOpenHit = (hit: RemoteHit) => {
    if (hit.notebookId && onSelectNotebook) {
      onSelectNotebook(hit.notebookId);
    }
    if ((hit.category === 'document' || hit.category === 'chunk') && hit.documentId && onOpenCitation) {
      onOpenCitation({
        documentId: hit.documentId,
        documentTitle: hit.title,
        excerpt: hit.snippet,
      });
      onClose();
      return;
    }

    const tabMap: Record<RemoteHit['category'], ActiveTab> = {
      notebook: 'dashboard',
      document: 'notebooklm',
      chunk: 'notebooklm',
      note: 'notes',
      flashcard: 'flashcards',
      quiz: 'quiz',
      chat: 'chat',
    };
    onNavigate(tabMap[hit.category]);
    onClose();
  };

  const getCategoryIcon = (cat: RemoteHit['category']) => {
    switch (cat) {
      case 'notebook':
        return <BookOpen className="w-3.5 h-3.5 text-indigo-500" />;
      case 'document':
      case 'chunk':
        return <FileText className="w-3.5 h-3.5 text-blue-500" />;
      case 'note':
        return <NotebookIcon className="w-3.5 h-3.5 text-emerald-500" />;
      case 'flashcard':
        return <Layers className="w-3.5 h-3.5 text-amber-500" />;
      case 'quiz':
        return <HelpCircle className="w-3.5 h-3.5 text-pink-500" />;
      case 'chat':
        return <MessageSquareText className="w-3.5 h-3.5 text-purple-500" />;
    }
  };

  const filterPills: Array<{ id: SearchCategory; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'notebooks', label: 'Notebooks' },
    { id: 'documents', label: 'Documents' },
    { id: 'chunks', label: 'Excerpts' },
    { id: 'notes', label: 'Notes' },
    { id: 'flashcards', label: 'Flashcards' },
    { id: 'quizzes', label: 'Quizzes' },
    { id: 'chats', label: 'Chats' },
  ];

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-start justify-center pt-16 p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-indigo-500 shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Search PDFs, excerpts, notes, flashcards, quizzes, and chats..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
          />
          {searching && <Sparkles className="w-4 h-4 text-indigo-500 animate-spin shrink-0" />}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category Filter Pills */}
        <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5 overflow-x-auto bg-slate-50/50 dark:bg-slate-950/30">
          {filterPills.map((pill) => (
            <button
              key={pill.id}
              onClick={() => setCategory(pill.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all shrink-0 ${
                category === pill.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Results Body */}
        <div className="max-h-[58vh] overflow-y-auto p-4 space-y-3 text-xs">
          {searchError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500">
              {searchError}
            </div>
          )}

          {!cleanQuery ? (
            <div className="space-y-4 py-4">
              {recentSearches.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Recent Searches
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recentSearches.map((rs) => (
                      <button
                        key={rs.id}
                        onClick={() => setQuery(rs.keyword)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px]"
                      >
                        {rs.keyword}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-center py-6 text-slate-400">
                Type keywords to search across all notebooks, PDFs, indexed passages, notes, flashcards, quizzes, and chat threads.
              </div>
            </div>
          ) : searching && hits.length === 0 ? (
            <div className="text-center py-8 text-slate-400">Searching your workspace...</div>
          ) : hits.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              No results found for "<span className="text-slate-200">{query}</span>"
            </div>
          ) : (
            <div className="space-y-2">
              {hits.map((hit) => (
                <button
                  key={`${hit.category}-${hit.id}`}
                  onClick={() => handleOpenHit(hit)}
                  className="w-full text-left p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-500 transition-all flex items-center justify-between gap-3 group"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(hit.category)}
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                        {hit.category}
                      </span>
                      {hit.meta && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-slate-700/60 text-slate-500 dark:text-slate-300">
                          {hit.meta}
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 truncate">
                      {highlightMatch(hit.title)}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                      {highlightMatch(hit.snippet)}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
