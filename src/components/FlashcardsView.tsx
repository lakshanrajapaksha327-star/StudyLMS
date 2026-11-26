import React, { useState, useEffect, useRef } from 'react';
import {
  Layers,
  Sparkles,
  RotateCw,
  Volume2,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  Star,
  Flame,
  Boxes,
  AlertCircle,
  Plus,
  Edit3,
  Trash2,
  Search,
  Repeat,
  Square,
  CalendarClock,
  Check,
  X,
  Download,
  Upload,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { FlashcardSet, Flashcard, SourceDocument, NoteItem } from '../types';
import {
  generateAIFlashcards,
  generateSpeechAudio,
  importWorkspaceItemsApi,
} from '../services/api';
import {
  exportToCsv,
  exportToDocx,
  exportToJson,
  exportToMarkdown,
  exportToPrintablePdf,
  parseFlashcardsImport,
} from '../utils/exportImport';

interface FlashcardsViewProps {
  sets: FlashcardSet[];
  sources?: SourceDocument[];
  notes?: NoteItem[];
  activeNotebookId: string;
  onAddSet: (newSet: FlashcardSet) => void;
  onUpdateSet?: (updatedSet: FlashcardSet) => void;
  onDeleteSet?: (setId: string) => void;
  onUpdateCardStatus: (setId: string, cardId: string, status: 'mastered' | 'learning') => void;
}

const VOICE_OPTIONS = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Aoede'];

export const FlashcardsView: React.FC<FlashcardsViewProps> = ({
  sets,
  sources = [],
  notes = [],
  activeNotebookId,
  onAddSet,
  onUpdateSet,
  onDeleteSet,
  onUpdateCardStatus,
}) => {
  const [activeSetId, setActiveSetId] = useState<string>(sets[0]?.id || '');
  const activeSet = sets.find((s) => s.id === activeSetId) || sets[0];

  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Audio controls
  const [playingAudio, setPlayingAudio] = useState(false);
  const [audioSpeed, setAudioSpeed] = useState<number>(1);
  const [voiceName, setVoiceName] = useState<string>('Kore');
  const [repeatAudio, setRepeatAudio] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const repeatRef = useRef<boolean>(false);
  repeatRef.current = repeatAudio;

  // Filtering & search
  const [shuffledOrder, setShuffledOrder] = useState<string[] | null>(null);
  const [filterMode, setFilterMode] = useState<
    'all' | 'due' | 'upcoming' | 'new' | 'learning' | 'mastered' | 'starred' | 'difficult' | 'leitner'
  >('all');
  const [selectedBox, setSelectedBox] = useState<number>(1);
  const [cardSearch, setCardSearch] = useState('');

  // Create AI Deck Modal
  const [showModal, setShowModal] = useState(false);
  const [sourceMode, setSourceMode] = useState<'topic' | 'document' | 'note'>('topic');
  const [topic, setTopic] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState<string>(sources[0]?.id || '');
  const [selectedNoteId, setSelectedNoteId] = useState<string>(notes[0]?.id || '');
  const [cardCount, setCardCount] = useState<number>(6);
  const [loadingAI, setLoadingAI] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Manual Card Create/Edit Modal & Deck Delete confirm
  const [showCardModal, setShowCardModal] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [cardQuestionInput, setCardQuestionInput] = useState('');
  const [cardAnswerInput, setCardAnswerInput] = useState('');
  const [cardHintInput, setCardHintInput] = useState('');
  const [confirmDeleteDeckId, setConfirmDeleteDeckId] = useState<string | null>(null);

  useEffect(() => {
    if (sets.length > 0 && !sets.some((s) => s.id === activeSetId)) {
      setActiveSetId(sets[0].id);
      setCardIndex(0);
      setShuffledOrder(null);
    }
  }, [sets, activeSetId]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const stopAudio = () => {
    repeatRef.current = false;
    setRepeatAudio(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setPlayingAudio(false);
  };

  const nowMs = Date.now();
  const isCardDue = (c: Flashcard) =>
    !c.nextReviewDate || new Date(c.nextReviewDate).getTime() <= nowMs;

  const getDisplayCards = () => {
    if (!activeSet?.cards) return [];
    let list = [...activeSet.cards];

    if (shuffledOrder) {
      const orderMap = new Map<string, number>(
        shuffledOrder.map((id, idx): [string, number] => [id, idx])
      );
      list.sort((a, b) => (orderMap.get(a.id) ?? 9999) - (orderMap.get(b.id) ?? 9999));
    }

    if (cardSearch.trim()) {
      const q = cardSearch.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.question.toLowerCase().includes(q) ||
          c.answer.toLowerCase().includes(q) ||
          (c.hint || '').toLowerCase().includes(q)
      );
    }

    if (filterMode === 'due') {
      list = list.filter((c) => isCardDue(c));
    } else if (filterMode === 'upcoming') {
      list = list.filter((c) => c.nextReviewDate && new Date(c.nextReviewDate).getTime() > nowMs);
    } else if (filterMode === 'new') {
      list = list.filter((c) => !c.status || c.status === 'unstudied');
    } else if (filterMode === 'learning') {
      list = list.filter((c) => c.status === 'learning');
    } else if (filterMode === 'mastered') {
      list = list.filter((c) => c.status === 'mastered');
    } else if (filterMode === 'starred') {
      list = list.filter((c) => Boolean(c.starred));
    } else if (filterMode === 'difficult') {
      list = list.filter((c) => (c.easeFactor ?? 2.5) < 2.2 || c.difficult || c.status === 'learning');
    } else if (filterMode === 'leitner') {
      list = list.filter((c) => (c.box || 1) === selectedBox);
    }
    return list;
  };

  const displayCards = getDisplayCards();
  const safeIndex = Math.min(cardIndex, Math.max(0, displayCards.length - 1));
  const currentCard: Flashcard | undefined = displayCards[safeIndex];

  const handleNext = () => {
    setIsFlipped(false);
    setShowHint(false);
    if (safeIndex < displayCards.length - 1) {
      setCardIndex(safeIndex + 1);
    }
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setShowHint(false);
    if (safeIndex > 0) {
      setCardIndex(safeIndex - 1);
    }
  };

  const handleShuffle = () => {
    if (!activeSet?.cards?.length) return;
    const ids = activeSet.cards.map((c) => c.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    setShuffledOrder(ids);
    setIsFlipped(false);
    setCardIndex(0);
  };

  const toggleStar = (cardId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeSet) return;
    const updatedSet: FlashcardSet = {
      ...activeSet,
      cards: activeSet.cards.map((c) => (c.id === cardId ? { ...c, starred: !c.starred } : c)),
    };
    onUpdateSet?.(updatedSet);
  };

  const handleSm2Rate = (quality: 1 | 2 | 3 | 4) => {
    if (!currentCard || !activeSet) return;

    let interval = currentCard.intervalDays ?? 1;
    let ease = currentCard.easeFactor ?? 2.5;
    let reps = currentCard.repetitions ?? 0;
    const currentBox = currentCard.box || 1;
    let nextStatus: 'mastered' | 'learning' = 'learning';
    let nextBox = currentBox;

    if (quality >= 3) {
      if (reps === 0) interval = 1;
      else if (reps === 1) interval = 6;
      else interval = Math.round(interval * ease);
      reps += 1;
      nextStatus = 'mastered';
      nextBox = Math.min(5, currentBox + 1);
      confetti({ particleCount: 25, spread: 50 });
    } else {
      reps = 0;
      interval = 1;
      nextStatus = 'learning';
      nextBox = quality === 1 ? 1 : currentBox;
    }

    ease = Math.max(1.3, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    const nextReviewDate = new Date(Date.now() + interval * 86400 * 1000).toISOString();

    const updatedSet: FlashcardSet = {
      ...activeSet,
      cards: activeSet.cards.map((c) =>
        c.id === currentCard.id
          ? {
              ...c,
              status: nextStatus,
              box: nextBox,
              easeFactor: Number(ease.toFixed(2)),
              intervalDays: interval,
              repetitions: reps,
              nextReviewDate,
              difficult: quality <= 2,
            }
          : c
      ),
    };

    onUpdateSet?.(updatedSet);
    onUpdateCardStatus(activeSet.id, currentCard.id, nextStatus);
    handleNext();
  };

  const handleSpeakCard = async (text: string) => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingAudio(true);
      setErrorMsg('');
      const base64Audio = await generateSpeechAudio(text, voiceName);
      const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
      audio.playbackRate = audioSpeed;
      audioRef.current = audio;
      audio.onended = () => {
        if (repeatRef.current) {
          audio.currentTime = 0;
          audio.play().catch(() => setPlayingAudio(false));
        } else {
          setPlayingAudio(false);
          audioRef.current = null;
        }
      };
      await audio.play();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Speech synthesis failed.');
      setPlayingAudio(false);
    }
  };

  const handleCreateAIDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loadingAI) return;

    let deckTitle = topic.trim();
    let sourceContent = '';

    if (sourceMode === 'document') {
      const doc = sources.find((s) => s.id === selectedSourceId) || sources[0];
      if (!doc) {
        setErrorMsg('No source document available in this notebook.');
        return;
      }
      deckTitle = deckTitle || doc.title;
      sourceContent = doc.content;
    } else if (sourceMode === 'note') {
      const note = notes.find((n) => n.id === selectedNoteId) || notes[0];
      if (!note) {
        setErrorMsg('No study note available in this notebook.');
        return;
      }
      deckTitle = deckTitle || note.title;
      sourceContent = note.content;
    } else if (!deckTitle) {
      setErrorMsg('Enter a topic to generate flashcards.');
      return;
    }

    setLoadingAI(true);
    setErrorMsg('');
    try {
      const generatedCards = await generateAIFlashcards(deckTitle, sourceContent, cardCount, activeNotebookId);

      const newSet: FlashcardSet = {
        id: `fc-${Date.now()}`,
        notebookId: activeNotebookId,
        title: deckTitle,
        description:
          sourceMode === 'document'
            ? `AI deck generated from document "${deckTitle}"`
            : sourceMode === 'note'
            ? `AI deck generated from study note "${deckTitle}"`
            : `AI generated study deck for ${deckTitle}`,
        category: sourceMode === 'note' ? 'Study Note' : sourceMode === 'document' ? 'Document' : 'Study Deck',
        createdAt: new Date().toISOString().split('T')[0],
        cards: generatedCards.map((c, idx) => ({
          id: `c-${Date.now()}-${idx}`,
          question: c.question || 'Question',
          answer: c.answer || 'Answer',
          hint: c.hint,
          status: 'unstudied',
          box: 1,
          easeFactor: 2.5,
        })),
      };

      onAddSet(newSet);
      setActiveSetId(newSet.id);
      setCardIndex(0);
      setShuffledOrder(null);
      setShowModal(false);
      setTopic('');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to generate flashcard deck.');
    } finally {
      setLoadingAI(false);
    }
  };

  const openAddCardModal = () => {
    setEditingCardId(null);
    setCardQuestionInput('');
    setCardAnswerInput('');
    setCardHintInput('');
    setShowCardModal(true);
  };

  const openEditCardModal = (card: Flashcard, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCardId(card.id);
    setCardQuestionInput(card.question);
    setCardAnswerInput(card.answer);
    setCardHintInput(card.hint || '');
    setShowCardModal(true);
  };

  const handleSaveManualCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSet || !cardQuestionInput.trim() || !cardAnswerInput.trim()) return;

    let updatedCards: Flashcard[];
    if (editingCardId) {
      updatedCards = activeSet.cards.map((c) =>
        c.id === editingCardId
          ? {
              ...c,
              question: cardQuestionInput.trim(),
              answer: cardAnswerInput.trim(),
              hint: cardHintInput.trim() || undefined,
            }
          : c
      );
    } else {
      const newCard: Flashcard = {
        id: `c-${Date.now()}`,
        question: cardQuestionInput.trim(),
        answer: cardAnswerInput.trim(),
        hint: cardHintInput.trim() || undefined,
        status: 'unstudied',
        box: 1,
        easeFactor: 2.5,
      };
      updatedCards = [...activeSet.cards, newCard];
      setCardIndex(updatedCards.length - 1);
    }

    onUpdateSet?.({ ...activeSet, cards: updatedCards });
    setShowCardModal(false);
    setEditingCardId(null);
  };

  const handleDeleteCurrentCard = (cardId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeSet) return;
    const updatedCards = activeSet.cards.filter((c) => c.id !== cardId);
    onUpdateSet?.({ ...activeSet, cards: updatedCards });
    setCardIndex((prev) => Math.max(0, Math.min(prev, updatedCards.length - 1)));
    setIsFlipped(false);
  };

  const masteredCount = activeSet?.cards.filter((c) => c.status === 'mastered').length || 0;
  const learningCount = activeSet?.cards.filter((c) => c.status === 'learning').length || 0;
  const dueCount = activeSet?.cards.filter((c) => isCardDue(c)).length || 0;
  const starredCount = activeSet?.cards.filter((c) => c.starred).length || 0;
  const totalCards = activeSet?.cards.length || 0;
  const progressPercent = totalCards > 0 ? Math.round((masteredCount / totalCards) * 100) : 0;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-amber-500" /> Flashcards & SM-2 Spaced Repetition
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Leitner 5-Box mastery, SM-2 due scheduling, custom card editing, and configurable voice audio.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label
            title="Import Flashcard Deck (.csv, .tsv, .json)"
            className="px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-4 h-4 text-emerald-500" />
            <span>Import CSV/JSON</span>
            <input
              type="file"
              accept=".csv,.tsv,.json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                setErrorMsg('');
                try {
                  const text = await file.text();
                  const rows = parseFlashcardsImport(file.name, text);
                  if (rows.length === 0) {
                    setErrorMsg('No valid flashcard rows found in the uploaded file.');
                    return;
                  }
                  const titleFromName = file.name.replace(/\.[^.]+$/, '') || 'Imported Deck';
                  try {
                    const res = await importWorkspaceItemsApi({
                      kind: 'flashcards',
                      notebookId: activeNotebookId,
                      title: titleFromName,
                      cards: rows,
                    });
                    if (res.flashcardSet) {
                      onAddSet(res.flashcardSet);
                      setActiveSetId(res.flashcardSet.id);
                      setCardIndex(0);
                      return;
                    }
                  } catch {
                    // Fallback to local state if unauthenticated (Demo mode)
                  }
                  const newSet: FlashcardSet = {
                    id: `fc-${Date.now()}`,
                    notebookId: activeNotebookId,
                    title: titleFromName,
                    description: `Imported ${rows.length} flashcards`,
                    category: 'Imported',
                    createdAt: new Date().toISOString().split('T')[0],
                    cards: rows.map((r, idx) => ({
                      id: `c-${Date.now()}-${idx}`,
                      question: r.question,
                      answer: r.answer,
                      hint: r.hint,
                      status: 'unstudied',
                      box: 1,
                      easeFactor: 2.5,
                    })),
                  };
                  onAddSet(newSet);
                  setActiveSetId(newSet.id);
                  setCardIndex(0);
                } catch (err: any) {
                  setErrorMsg(err?.message || 'Failed to import flashcard deck.');
                }
              }}
            />
          </label>

          {activeSet && (
            <>
              <button
                onClick={openAddCardModal}
                className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4 text-amber-500" /> Add Card
              </button>
              <button
                type="button"
                onClick={() =>
                  exportToCsv(
                    activeSet.title,
                    ['Question', 'Answer', 'Hint', 'Status', 'Box'],
                    activeSet.cards.map((c) => [
                      c.question,
                      c.answer,
                      c.hint || '',
                      c.status || 'unstudied',
                      c.box || 1,
                    ])
                  )
                }
                className="px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1"
                title="Export CSV"
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button
                type="button"
                onClick={() =>
                  exportToDocx(
                    activeSet.title,
                    activeSet.title,
                    activeSet.cards.map((c, i) => ({
                      heading: `Card ${i + 1}`,
                      body: `Q: ${c.question}\nA: ${c.answer}${c.hint ? `\nHint: ${c.hint}` : ''}`,
                    }))
                  )
                }
                className="px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
              >
                DOCX
              </button>
              <button
                type="button"
                onClick={() =>
                  exportToPrintablePdf(
                    activeSet.title,
                    activeSet.cards.map((c, i) => ({
                      heading: `Card ${i + 1}`,
                      body: `Q: ${c.question}\nA: ${c.answer}${c.hint ? `\nHint: ${c.hint}` : ''}`,
                    }))
                  )
                }
                className="px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
              >
                PDF
              </button>
              <button
                type="button"
                onClick={() =>
                  exportToMarkdown(
                    activeSet.title,
                    activeSet.title,
                    activeSet.cards.map((c, i) => ({
                      heading: `Card ${i + 1}`,
                      body: `**Q:** ${c.question}\n\n**A:** ${c.answer}`,
                    }))
                  )
                }
                className="px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
              >
                .MD
              </button>
              <button
                type="button"
                onClick={() => exportToJson(activeSet.title, activeSet)}
                className="px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
              >
                JSON
              </button>
            </>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4" /> Create Deck with AI
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Deck Selector Tabs & Audio Settings */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 overflow-x-auto">
          {sets.map((set) => {
            const isSelected = set.id === (activeSet?.id || activeSetId);
            return (
              <div key={set.id} className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => {
                    setActiveSetId(set.id);
                    setCardIndex(0);
                    setIsFlipped(false);
                    setShuffledOrder(null);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-400'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-400'
                  }`}
                >
                  {set.title} ({set.cards.length})
                </button>
                {onDeleteSet && isSelected && (
                  confirmDeleteDeckId === set.id ? (
                    <div className="flex items-center gap-1 bg-rose-500/10 border border-rose-500/30 px-2 py-1 rounded-xl text-[10px]">
                      <button
                        onClick={() => {
                          onDeleteSet(set.id);
                          setConfirmDeleteDeckId(null);
                        }}
                        className="text-rose-500 font-bold flex items-center gap-0.5"
                        title="Confirm delete deck"
                      >
                        <Check className="w-3 h-3" /> Delete
                      </button>
                      <button
                        onClick={() => setConfirmDeleteDeckId(null)}
                        className="text-slate-400 hover:text-slate-200"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteDeckId(set.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10"
                      title="Delete Deck"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>

        {/* TTS Audio Config Bar */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0">
          <Volume2 className="w-3.5 h-3.5 text-amber-500" />
          <select
            value={voiceName}
            onChange={(e) => setVoiceName(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-0.5 text-[11px]"
            title="TTS Voice"
          >
            {VOICE_OPTIONS.map((v) => (
              <option key={v} value={v}>
                Voice: {v}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1">
            {[0.75, 1, 1.25, 1.5].map((spd) => (
              <button
                key={spd}
                onClick={() => setAudioSpeed(spd)}
                className={`px-1.5 py-0.5 rounded text-[10px] ${
                  audioSpeed === spd
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          <button
            onClick={() => setRepeatAudio((r) => !r)}
            className={`px-2 py-0.5 rounded-lg text-[10px] flex items-center gap-1 border ${
              repeatAudio
                ? 'bg-indigo-600 text-white border-indigo-500'
                : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700'
            }`}
            title="Repeat pronunciation"
          >
            <Repeat className="w-3 h-3" /> Repeat
          </button>

          {playingAudio && (
            <button
              onClick={stopAudio}
              className="px-2 py-0.5 rounded-lg text-[10px] bg-rose-500 text-white flex items-center gap-1"
            >
              <Square className="w-2.5 h-2.5 fill-current" /> Stop
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-3 bg-slate-100/70 dark:bg-slate-900/70 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', label: `All (${totalCards})` },
                { id: 'due', label: `Due Today (${dueCount})` },
                { id: 'upcoming', label: 'Upcoming' },
                { id: 'new', label: 'New' },
                { id: 'learning', label: `Learning (${learningCount})` },
                { id: 'mastered', label: `Mastered (${masteredCount})` },
                { id: 'starred', label: `Starred (${starredCount})` },
                { id: 'difficult', label: 'Difficult' },
                { id: 'leitner', label: 'Leitner 5-Box' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setFilterMode(f.id);
                  setCardIndex(0);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 ${
                  filterMode === f.id
                    ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-amber-400'
                }`}
              >
                {f.id === 'starred' && <Star className="w-3 h-3 fill-current text-amber-400" />}
                {f.id === 'difficult' && <Flame className="w-3 h-3 text-rose-500" />}
                {f.id === 'leitner' && <Boxes className="w-3 h-3 text-indigo-400" />}
                {f.id === 'due' && <CalendarClock className="w-3 h-3 text-emerald-400" />}
                <span>{f.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                value={cardSearch}
                onChange={(e) => {
                  setCardSearch(e.target.value);
                  setCardIndex(0);
                }}
                placeholder="Search cards..."
                className="pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs w-44 focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              onClick={handleShuffle}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1"
            >
              <Shuffle className="w-3.5 h-3.5 text-amber-500" /> Shuffle
            </button>
          </div>
        </div>

        {filterMode === 'leitner' && (
          <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200 dark:border-slate-800">
            <span className="text-[11px] font-bold text-slate-400 mr-1">Leitner Box:</span>
            {[1, 2, 3, 4, 5].map((boxNum) => (
              <button
                key={boxNum}
                onClick={() => {
                  setSelectedBox(boxNum);
                  setCardIndex(0);
                }}
                className={`w-7 h-7 rounded-lg text-xs font-extrabold transition-all border ${
                  selectedBox === boxNum
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                {boxNum}
              </button>
            ))}
          </div>
        )}
      </div>

      {activeSet && currentCard ? (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>
              Card {safeIndex + 1} of {displayCards.length}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-emerald-600 dark:text-emerald-400">{masteredCount} Mastered</span>
              <span className="text-amber-600 dark:text-amber-400">{learningCount} Learning</span>
              <span className="text-indigo-500 font-bold">
                Box {currentCard.box || 1} • EF {(currentCard.easeFactor ?? 2.5).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div
            onClick={() => setIsFlipped(!isFlipped)}
            className="group cursor-pointer min-h-[320px] relative w-full"
          >
            <div
              className={`w-full min-h-[320px] rounded-3xl p-8 border-2 transition-all duration-500 flex flex-col justify-between shadow-xl relative ${
                isFlipped
                  ? 'bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-950 border-indigo-500 text-white'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 hover:border-amber-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {isFlipped ? 'ANSWER' : 'QUESTION'}
                  </span>
                  {currentCard.nextReviewDate && (
                    <span className="text-[10px] text-slate-400">
                      Next: {new Date(currentCard.nextReviewDate).toLocaleDateString()}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => toggleStar(currentCard.id, e)}
                    className="p-1.5 rounded-xl hover:bg-amber-500/10 text-amber-500"
                    title="Star Favorite"
                  >
                    <Star
                      className={`w-4 h-4 ${
                        currentCard.starred ? 'fill-amber-400 text-amber-400' : 'text-slate-400'
                      }`}
                    />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSpeakCard(isFlipped ? currentCard.answer : currentCard.question);
                    }}
                    className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-300"
                    title="Listen Pronunciation"
                  >
                    <Volume2 className={`w-4 h-4 ${playingAudio ? 'animate-bounce text-amber-500' : ''}`} />
                  </button>

                  <button
                    onClick={(e) => openEditCardModal(currentCard, e)}
                    className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-400"
                    title="Edit Card"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={(e) => handleDeleteCurrentCard(currentCard.id, e)}
                    className="p-1.5 rounded-xl hover:bg-rose-500/10 text-slate-400 hover:text-rose-500"
                    title="Delete Card"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="text-center my-auto px-4">
                <p className="text-lg md:text-xl font-bold tracking-tight leading-relaxed">
                  {isFlipped ? currentCard.answer : currentCard.question}
                </p>

                {!isFlipped && currentCard.hint && showHint && (
                  <p className="mt-4 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2 rounded-xl border border-amber-500/20 inline-block">
                    Hint: {currentCard.hint}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                {!isFlipped && currentCard.hint && !showHint ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowHint(true);
                    }}
                    className="text-amber-500 hover:underline font-semibold"
                  >
                    Show Hint
                  </button>
                ) : (
                  <span />
                )}

                <span className="flex items-center gap-1 font-semibold text-indigo-500">
                  <RotateCw className="w-3.5 h-3.5" /> Click to flip
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-[11px] font-bold text-center uppercase tracking-wider text-slate-400">
              SM-2 Recall Rating
            </div>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => handleSm2Rate(1)}
                className="py-2.5 px-2 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition-all text-center"
              >
                Again (1)
                <span className="block text-[9px] font-normal opacity-80">Reset Box 1</span>
              </button>

              <button
                onClick={() => handleSm2Rate(2)}
                className="py-2.5 px-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold transition-all text-center"
              >
                Hard (2)
                <span className="block text-[9px] font-normal opacity-80">Keep Box</span>
              </button>

              <button
                onClick={() => handleSm2Rate(3)}
                className="py-2.5 px-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 rounded-xl text-xs font-bold transition-all text-center"
              >
                Good (3)
                <span className="block text-[9px] font-normal opacity-80">+1 Box</span>
              </button>

              <button
                onClick={() => handleSm2Rate(4)}
                className="py-2.5 px-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all text-center"
              >
                Easy (4)
                <span className="block text-[9px] font-normal opacity-80">+1 Box</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={handlePrev}
              disabled={safeIndex === 0}
              className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-100"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <span className="text-xs font-semibold text-slate-400">
              {safeIndex + 1} / {displayCards.length} Cards
            </span>

            <button
              onClick={handleNext}
              disabled={safeIndex === displayCards.length - 1}
              className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-100"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
          <Layers className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-800 dark:text-slate-200">No flashcards match this view</h3>
          <p className="text-xs text-slate-500">
            Create a deck with AI, add cards manually, or switch filter back to All.
          </p>
        </div>
      )}

      {/* AI Deck Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" /> Create Flashcard Deck with AI
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Generate from a topic, an uploaded notebook document, or one of your study notes.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-1.5 bg-slate-800 p-1 rounded-xl text-xs font-semibold">
              {(['topic', 'document', 'note'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSourceMode(m)}
                  className={`py-1.5 rounded-lg capitalize transition-all ${
                    sourceMode === m ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <form onSubmit={handleCreateAIDeck} className="space-y-4">
              {sourceMode === 'document' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Source Document
                  </label>
                  <select
                    value={selectedSourceId}
                    onChange={(e) => setSelectedSourceId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    {sources.length === 0 ? (
                      <option value="">No documents in active notebook</option>
                    ) : (
                      sources.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              {sourceMode === 'note' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Study Note
                  </label>
                  <select
                    value={selectedNoteId}
                    onChange={(e) => setSelectedNoteId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    {notes.length === 0 ? (
                      <option value="">No notes in active notebook</option>
                    ) : (
                      notes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.title}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {sourceMode === 'topic' ? 'Study Topic' : 'Deck Title (Optional override)'}
                </label>
                <input
                  type="text"
                  required={sourceMode === 'topic'}
                  placeholder="e.g. Krebs Cycle or Transformer Attention"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Number of Cards ({cardCount})
                </label>
                <select
                  value={cardCount}
                  onChange={(e) => setCardCount(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                >
                  {[4, 6, 8, 12].map((n) => (
                    <option key={n} value={n}>
                      {n} Cards
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loadingAI}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl shadow flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Sparkles className={`w-4 h-4 ${loadingAI ? 'animate-spin' : ''}`} />
                  <span>{loadingAI ? 'Generating Cards...' : 'Generate Deck'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Card Add / Edit Modal */}
      {showCardModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-base font-bold">
              {editingCardId ? 'Edit Flashcard' : 'Add Flashcard Manually'}
            </h3>
            <form onSubmit={handleSaveManualCard} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Question</label>
                <textarea
                  rows={2}
                  required
                  value={cardQuestionInput}
                  onChange={(e) => setCardQuestionInput(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Answer</label>
                <textarea
                  rows={3}
                  required
                  value={cardAnswerInput}
                  onChange={(e) => setCardAnswerInput(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Hint (Optional)</label>
                <input
                  type="text"
                  value={cardHintInput}
                  onChange={(e) => setCardHintInput(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCardModal(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl"
                >
                  {editingCardId ? 'Update Card' : 'Add Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
