import React, { useState } from 'react';
import {
  Layers,
  Sparkles,
  RotateCw,
  CheckCircle2,
  XCircle,
  Volume2,
  ChevronLeft,
  ChevronRight,
  Plus,
  HelpCircle,
  Trophy,
  Shuffle,
  Star,
  Flame,
  Boxes,
  Zap,
  Settings
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { FlashcardSet, Flashcard } from '../types';
import { generateAIFlashcards, generateSpeechAudio } from '../services/api';

interface FlashcardsViewProps {
  sets: FlashcardSet[];
  onAddSet: (newSet: FlashcardSet) => void;
  onUpdateCardStatus: (setId: string, cardId: string, status: 'mastered' | 'learning') => void;
}

export const FlashcardsView: React.FC<FlashcardsViewProps> = ({
  sets,
  onAddSet,
  onUpdateCardStatus,
}) => {
  const [activeSetId, setActiveSetId] = useState<string>(sets[0]?.id || '');
  const activeSet = sets.find((s) => s.id === activeSetId) || sets[0];

  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(false);

  // Audio settings
  const [audioSpeed, setAudioSpeed] = useState<number>(1);

  // Card filter & SM-2 / Leitner state
  const [filterMode, setFilterMode] = useState<'all' | 'starred' | 'difficult' | 'leitner'>('all');
  const [selectedBox, setSelectedBox] = useState<number>(1);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [leitnerBoxes, setLeitnerBoxes] = useState<Record<string, number>>({});
  const [cardSm2, setCardSm2] = useState<Record<string, { interval: number; ease: number; reps: number }>>({});

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [topic, setTopic] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);

  // Compute filtered card list based on current filter mode
  const getDisplayCards = () => {
    if (!activeSet?.cards) return [];
    let list = [...activeSet.cards];

    if (filterMode === 'starred') {
      list = list.filter((c) => starredIds.has(c.id));
    } else if (filterMode === 'difficult') {
      list = list.filter((c) => {
        const ease = cardSm2[c.id]?.ease ?? 2.5;
        return ease < 2.2 || c.status === 'learning';
      });
    } else if (filterMode === 'leitner') {
      list = list.filter((c) => (leitnerBoxes[c.id] || 1) === selectedBox);
    }
    return list;
  };

  const displayCards = getDisplayCards();
  const currentCard: Flashcard | undefined = displayCards[cardIndex];

  const handleNext = () => {
    setIsFlipped(false);
    setShowHint(false);
    if (cardIndex < displayCards.length - 1) {
      setCardIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setShowHint(false);
    if (cardIndex > 0) {
      setCardIndex((prev) => prev - 1);
    }
  };

  const handleShuffle = () => {
    if (!activeSet) return;
    setIsFlipped(false);
    setCardIndex(0);
    // Trigger visual shuffle notice
    confetti({ particleCount: 20, spread: 40, origin: { y: 0.8 } });
  };

  const toggleStar = (cardId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  // SM-2 Spaced Repetition Algorithm calculation
  const handleSm2Rate = (quality: 1 | 2 | 3 | 4) => {
    if (!currentCard || !activeSet) return;

    const curr = cardSm2[currentCard.id] || { interval: 1, ease: 2.5, reps: 0 };
    let { interval, ease, reps } = curr;

    if (quality >= 3) {
      if (reps === 0) interval = 1;
      else if (reps === 1) interval = 6;
      else interval = Math.round(interval * ease);
      reps += 1;
      onUpdateCardStatus(activeSet.id, currentCard.id, 'mastered');
      confetti({ particleCount: 25, spread: 50 });
    } else {
      reps = 0;
      interval = 1;
      onUpdateCardStatus(activeSet.id, currentCard.id, 'learning');
    }

    ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (ease < 1.3) ease = 1.3;

    setCardSm2((prev) => ({
      ...prev,
      [currentCard.id]: { interval, ease, reps },
    }));

    // Update Leitner Box (1 to 5)
    setLeitnerBoxes((prev) => {
      const currentBox = prev[currentCard.id] || 1;
      const nextBox = quality >= 3 ? Math.min(5, currentBox + 1) : 1;
      return { ...prev, [currentCard.id]: nextBox };
    });

    handleNext();
  };

  const handleSpeakCard = async (text: string) => {
    try {
      setPlayingAudio(true);
      const base64Audio = await generateSpeechAudio(text);
      const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
      audio.playbackRate = audioSpeed;
      audio.play();
      audio.onended = () => setPlayingAudio(false);
    } catch (err) {
      console.error(err);
      setPlayingAudio(false);
    }
  };

  const handleCreateAIDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || loadingAI) return;

    setLoadingAI(true);
    try {
      const generatedCards = await generateAIFlashcards(topic, '', 5);

      const newSet: FlashcardSet = {
        id: `fc-${Date.now()}`,
        notebookId: 'nb-1',
        title: topic,
        description: `AI generated Quizlet deck for ${topic}`,
        category: 'Study Deck',
        createdAt: new Date().toISOString().split('T')[0],
        cards: generatedCards.map((c, idx) => ({
          id: `c-${Date.now()}-${idx}`,
          question: c.question || 'Question',
          answer: c.answer || 'Answer',
          hint: c.hint,
          status: 'unstudied',
        })),
      };

      onAddSet(newSet);
      setActiveSetId(newSet.id);
      setCardIndex(0);
      setShowModal(false);
      setTopic('');
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAI(false);
    }
  };

  // Stats for active set
  const masteredCount = activeSet?.cards.filter((c) => c.status === 'mastered').length || 0;
  const learningCount = activeSet?.cards.filter((c) => c.status === 'learning').length || 0;
  const totalCards = activeSet?.cards.length || 0;
  const progressPercent = totalCards > 0 ? Math.round((masteredCount / totalCards) * 100) : 0;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-amber-500" /> Quizlet Flashcards & SM-2 Anki Engine
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Master terms with Leitner 5-Box system, Anki SM-2 spaced repetition algorithm, and speech controls.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4" /> Create Deck with AI
          </button>
        </div>
      </div>

      {/* Deck Selector Tabs */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          {sets.map((set) => {
            const isSelected = set.id === activeSetId;
            return (
              <button
                key={set.id}
                onClick={() => {
                  setActiveSetId(set.id);
                  setCardIndex(0);
                  setIsFlipped(false);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-400'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-400'
                }`}
              >
                {set.title} ({set.cards.length} cards)
              </button>
            );
          })}
        </div>

        {/* Audio Speed Control */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0">
          <Volume2 className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-[11px] text-slate-500">Speed:</span>
          {[0.75, 1, 1.25, 1.5].map((spd) => (
            <button
              key={spd}
              onClick={() => setAudioSpeed(spd)}
              className={`px-1.5 py-0.5 rounded text-[10px] ${
                audioSpeed === spd ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>

      {/* Leitner Box & Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100/70 dark:bg-slate-900/70 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setFilterMode('all');
              setCardIndex(0);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterMode === 'all'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            All Cards ({activeSet?.cards.length || 0})
          </button>

          <button
            onClick={() => {
              setFilterMode('starred');
              setCardIndex(0);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
              filterMode === 'starred'
                ? 'bg-amber-500 text-slate-950'
                : 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
            }`}
          >
            <Star className="w-3.5 h-3.5 fill-current" /> Starred ({starredIds.size})
          </button>

          <button
            onClick={() => {
              setFilterMode('difficult');
              setCardIndex(0);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
              filterMode === 'difficult'
                ? 'bg-red-500 text-white'
                : 'text-red-600 dark:text-red-400 hover:bg-red-500/10'
            }`}
          >
            <Flame className="w-3.5 h-3.5" /> Difficult Cards
          </button>

          <button
            onClick={() => {
              setFilterMode('leitner');
              setCardIndex(0);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
              filterMode === 'leitner'
                ? 'bg-indigo-600 text-white'
                : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" /> Leitner 5-Box
          </button>
        </div>

        {/* Leitner Box Selectors */}
        {filterMode === 'leitner' && (
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-bold text-slate-400 mr-1">Box:</span>
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

        <button
          onClick={handleShuffle}
          className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1"
        >
          <Shuffle className="w-3.5 h-3.5 text-amber-500" /> Shuffle Deck
        </button>
      </div>

      {activeSet && currentCard ? (
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Progress Bar & Counter */}
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>
              Card {cardIndex + 1} of {displayCards.length}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-emerald-600 dark:text-emerald-400">✓ {masteredCount} Mastered</span>
              <span className="text-amber-600 dark:text-amber-400">⏳ {learningCount} Learning</span>
              <span className="text-indigo-500 font-bold">Box {leitnerBoxes[currentCard.id] || 1}</span>
            </div>
          </div>

          <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* 3D Flip Card Container */}
          <div
            onClick={() => setIsFlipped(!isFlipped)}
            className="group cursor-pointer perspective-1000 min-h-[320px] relative w-full"
          >
            <div
              className={`w-full min-h-[320px] rounded-3xl p-8 border-2 transition-all duration-500 transform-gpu flex flex-col justify-between shadow-xl relative ${
                isFlipped
                  ? 'bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-950 border-indigo-500 text-white'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 hover:border-amber-400'
              }`}
            >
              {/* Card Header Tag & Star Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {isFlipped ? 'ANSWER' : 'QUESTION'}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => toggleStar(currentCard.id, e)}
                    className="p-1.5 rounded-xl hover:bg-amber-500/10 text-amber-500"
                    title="Star Favorite"
                  >
                    <Star
                      className={`w-4 h-4 ${
                        starredIds.has(currentCard.id) ? 'fill-amber-400 text-amber-400' : 'text-slate-400'
                      }`}
                    />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSpeakCard(isFlipped ? currentCard.answer : currentCard.question);
                    }}
                    className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-300 transition-colors"
                    title="Listen Pronunciation"
                  >
                    <Volume2 className={`w-4 h-4 ${playingAudio ? 'animate-bounce text-amber-500' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Card Body Content */}
              <div className="text-center my-auto px-4">
                <p className="text-lg md:text-xl font-bold tracking-tight leading-relaxed">
                  {isFlipped ? currentCard.answer : currentCard.question}
                </p>

                {!isFlipped && currentCard.hint && showHint && (
                  <p className="mt-4 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2 rounded-xl border border-amber-500/20 inline-block">
                    💡 Hint: {currentCard.hint}
                  </p>
                )}
              </div>

              {/* Card Footer controls */}
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

          {/* Anki SM-2 Spaced Repetition Buttons */}
          <div className="space-y-3">
            <div className="text-[11px] font-bold text-center uppercase tracking-wider text-slate-400">
              Anki SM-2 Recall Difficulty
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

          {/* Prev / Next controls */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={handlePrev}
              disabled={cardIndex === 0}
              className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-100"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <span className="text-xs font-semibold text-slate-400">
              {cardIndex + 1} / {displayCards.length} Cards
            </span>

            <button
              onClick={handleNext}
              disabled={cardIndex === displayCards.length - 1}
              className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-100"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 dark:text-slate-200">No matching cards found</h3>
          <p className="text-xs text-slate-500 mt-1">Try switching filter mode to "All Cards".</p>
        </div>
      )}

      {/* AI Deck Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" /> Generate Flashcard Deck with Gemini
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter any topic or concept. AI will create structured question/answer flashcards.
            </p>

            <form onSubmit={handleCreateAIDeck} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Study Topic</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Krebs Cycle Biochemistry or Machine Learning Loss Functions"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
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
                  {loadingAI ? <Sparkles className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>{loadingAI ? 'Generating Cards...' : 'Generate Deck'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

