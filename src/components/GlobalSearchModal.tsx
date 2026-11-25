import React, { useState } from 'react';
import { Search, X, FileText, Notebook, Layers, HelpCircle, MessageSquareText, ArrowRight } from 'lucide-react';
import { SourceDocument, NoteItem, FlashcardSet, QuizSet, ActiveTab } from '../types';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  sources: SourceDocument[];
  notes: NoteItem[];
  flashcardSets: FlashcardSet[];
  quizSets: QuizSet[];
  onNavigate: (tab: ActiveTab) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  sources,
  notes,
  flashcardSets,
  quizSets,
  onNavigate,
}) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const cleanQuery = query.toLowerCase().trim();

  const filteredSources = cleanQuery
    ? sources.filter((s) => s.title.toLowerCase().includes(cleanQuery) || s.content.toLowerCase().includes(cleanQuery))
    : [];

  const filteredNotes = cleanQuery
    ? notes.filter((n) => n.title.toLowerCase().includes(cleanQuery) || n.content.toLowerCase().includes(cleanQuery))
    : [];

  const filteredFlashcards = cleanQuery
    ? flashcardSets.filter((fc) =>
        fc.title.toLowerCase().includes(cleanQuery) ||
        fc.cards.some((c) => c.question.toLowerCase().includes(cleanQuery) || c.answer.toLowerCase().includes(cleanQuery))
      )
    : [];

  const filteredQuizzes = cleanQuery
    ? quizSets.filter((q) =>
        q.title.toLowerCase().includes(cleanQuery) ||
        q.questions.some((item) => item.question.toLowerCase().includes(cleanQuery))
      )
    : [];

  const totalResults =
    filteredSources.length + filteredNotes.length + filteredFlashcards.length + filteredQuizzes.length;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-start justify-center pt-20 p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-indigo-500 shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Search everything (PDFs, Notes, Flashcards, Quizzes)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results Body */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4 text-xs">
          {!cleanQuery ? (
            <div className="text-center py-8 text-slate-400">
              Type keywords to search across all study documents, notes, flashcard decks, and practice tests.
            </div>
          ) : totalResults === 0 ? (
            <div className="text-center py-8 text-slate-400">
              No results found for "<span className="text-slate-200">{query}</span>"
            </div>
          ) : (
            <>
              {/* Grounded PDF Sources */}
              {filteredSources.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> Sources & PDFs ({filteredSources.length})
                  </div>
                  {filteredSources.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        onNavigate('notebooklm');
                        onClose();
                      }}
                      className="w-full text-left p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-500 transition-all flex items-center justify-between group"
                    >
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-slate-100">{s.title}</h4>
                        <p className="text-[11px] text-slate-500 line-clamp-1">{s.summary || s.content}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {/* Notes */}
              {filteredNotes.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <Notebook className="w-3.5 h-3.5" /> Notes ({filteredNotes.length})
                  </div>
                  {filteredNotes.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        onNavigate('notes');
                        onClose();
                      }}
                      className="w-full text-left p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500 transition-all flex items-center justify-between group"
                    >
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-slate-100">{n.title}</h4>
                        <p className="text-[11px] text-slate-500 line-clamp-1">{n.content}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {/* Flashcards */}
              {filteredFlashcards.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" /> Flashcard Decks ({filteredFlashcards.length})
                  </div>
                  {filteredFlashcards.map((fc) => (
                    <button
                      key={fc.id}
                      onClick={() => {
                        onNavigate('flashcards');
                        onClose();
                      }}
                      className="w-full text-left p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 hover:border-amber-500 transition-all flex items-center justify-between group"
                    >
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-slate-100">{fc.title}</h4>
                        <p className="text-[11px] text-slate-500">{fc.cards.length} cards in deck</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {/* Quizzes */}
              {filteredQuizzes.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase text-pink-600 dark:text-pink-400 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5" /> Practice Tests ({filteredQuizzes.length})
                  </div>
                  {filteredQuizzes.map((q) => (
                    <button
                      key={q.id}
                      onClick={() => {
                        onNavigate('quiz');
                        onClose();
                      }}
                      className="w-full text-left p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 hover:border-pink-500 transition-all flex items-center justify-between group"
                    >
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-slate-100">{q.title}</h4>
                        <p className="text-[11px] text-slate-500">{q.questions.length} practice questions</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-pink-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
