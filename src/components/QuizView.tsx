import React, { useState, useEffect } from 'react';
import {
  HelpCircle,
  Sparkles,
  XCircle,
  Award,
  RotateCcw,
  Brain,
  Check,
  Timer,
  Trophy,
  BookOpen,
  AlertCircle,
  Filter,
  TrendingUp,
  Download,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { NoteItem, QuizAttemptItem, QuizQuestion, QuizSet, SourceDocument } from '../types';
import { evaluateShortAnswerApi, generateAIQuiz } from '../services/api';
import {
  exportToCsv,
  exportToDocx,
  exportToJson,
  exportToMarkdown,
  exportToPrintablePdf,
} from '../utils/exportImport';

interface QuizViewProps {
  quizSets: QuizSet[];
  quizAttempts?: QuizAttemptItem[];
  sources?: SourceDocument[];
  notes?: NoteItem[];
  activeNotebookId: string;
  isAuthenticated?: boolean;
  onAddQuizSet: (newSet: QuizSet) => void;
  onSubmitAttempt?: (attempt: {
    quizSetId: string;
    quizTitle: string;
    score: number;
    scorePercent: number;
    totalQuestions: number;
    correctCount: number;
    timeTakenSeconds?: number;
    answers?: Record<string, string>;
  }) => void;
  onCompleteQuiz: () => void;
}

const QUESTION_FORMATS = [
  { id: 'mixed', label: 'Mixed Formats' },
  { id: 'multiple-choice', label: 'Multiple Choice' },
  { id: 'true-false', label: 'True / False' },
  { id: 'short-answer', label: 'Short Answer' },
  { id: 'fill-in-the-blank', label: 'Fill in the Blank' },
  { id: 'matching', label: 'Matching Pairs' },
  { id: 'scenario', label: 'Scenario / Case' },
];

export const QuizView: React.FC<QuizViewProps> = ({
  quizSets,
  quizAttempts = [],
  sources = [],
  notes = [],
  activeNotebookId,
  isAuthenticated = false,
  onAddQuizSet,
  onSubmitAttempt,
  onCompleteQuiz,
}) => {
  const [activeQuizId, setActiveQuizId] = useState<string>(quizSets[0]?.id || '');
  const activeQuiz = quizSets.find((q) => q.id === activeQuizId) || quizSets[0];

  const [activeTab, setActiveTab] = useState<'quiz' | 'bank' | 'leaderboard'>('quiz');
  const [mode, setMode] = useState<'practice' | 'exam'>('practice');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [enableNegativeMarking, setEnableNegativeMarking] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState<number>(10);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(10 * 60);
  const [timerRunning, setTimerRunning] = useState(false);

  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [aiEvaluations, setAiEvaluations] = useState<
    Record<string, { isCorrect: boolean; scorePercent: number; feedback: string; missingPoints?: string[] }>
  >({});
  const [evaluatingSubmit, setEvaluatingSubmit] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [reviewMistakesOnly, setReviewMistakesOnly] = useState(false);

  // Generation Modal
  const [showModal, setShowModal] = useState(false);
  const [sourceMode, setSourceMode] = useState<'topic' | 'document' | 'note'>('topic');
  const [topic, setTopic] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState<string>(sources[0]?.id || '');
  const [selectedNoteId, setSelectedNoteId] = useState<string>(notes[0]?.id || '');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [questionFormat, setQuestionFormat] = useState<string>('mixed');
  const [loadingAI, setLoadingAI] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (quizSets.length > 0 && !quizSets.some((q) => q.id === activeQuizId)) {
      setActiveQuizId(quizSets[0].id);
      handleReset();
    }
  }, [quizSets, activeQuizId]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (timerRunning && timeLeftSeconds > 0 && !submitted) {
      timer = setInterval(() => {
        setTimeLeftSeconds((prev) => {
          if (prev <= 1) {
            if (timer) clearInterval(timer);
            handleSubmitQuiz();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [timerRunning, timeLeftSeconds, submitted]);

  const startExamTimer = () => {
    setTimeLeftSeconds(timerMinutes * 60);
    setTimerRunning(true);
  };

  const handleSelectOption = (qId: string, option: string) => {
    if (submitted && mode === 'exam') return;
    setUserAnswers((prev) => ({ ...prev, [qId]: option }));

    if (!timerRunning && mode === 'exam') {
      startExamTimer();
    }
  };

  const isQuestionCorrect = (
    q: QuizQuestion,
    evalMap: Record<string, { isCorrect: boolean; scorePercent: number; feedback: string }> = aiEvaluations
  ): boolean => {
    if (evalMap[q.id]) return evalMap[q.id].isCorrect;
    const ans = (userAnswers[q.id] || '').trim().toLowerCase();
    const correct = (q.correctAnswer || '').trim().toLowerCase();
    if (!ans) return false;
    if (ans === correct) return true;
    if (
      (q.type === 'short-answer' || q.type === 'fill-in-the-blank' || q.type === 'scenario') &&
      ans.length >= 3 &&
      (correct.includes(ans) || ans.includes(correct))
    ) {
      return true;
    }
    return false;
  };

  const computeScore = (
    evalMap: Record<string, { isCorrect: boolean; scorePercent: number; feedback: string }> = aiEvaluations
  ) => {
    if (!activeQuiz) return { rawScore: 0, negativeDeductions: 0, finalScore: 0 };
    let rawScore = 0;
    let negativeDeductions = 0;

    activeQuiz.questions.forEach((q) => {
      const ans = userAnswers[q.id]?.trim();
      if (ans) {
        if (isQuestionCorrect(q, evalMap)) {
          rawScore += 1;
        } else if (enableNegativeMarking) {
          negativeDeductions += 0.25;
        }
      }
    });

    const finalScore = Math.max(0, rawScore - negativeDeductions);
    return { rawScore, negativeDeductions, finalScore };
  };

  const handleSubmitQuiz = async () => {
    if (!activeQuiz || submitted || evaluatingSubmit) return;
    setTimerRunning(false);
    setEvaluatingSubmit(true);

    const nextEvals: Record<
      string,
      { isCorrect: boolean; scorePercent: number; feedback: string; missingPoints?: string[] }
    > = { ...aiEvaluations };

    // Evaluate open-ended questions via backend AI grader when authenticated
    if (isAuthenticated) {
      const openQuestions = activeQuiz.questions.filter(
        (q) =>
          (!q.options || q.options.length === 0) &&
          (userAnswers[q.id] || '').trim().length > 0 &&
          (q.type === 'short-answer' || q.type === 'fill-in-the-blank' || q.type === 'scenario')
      );

      await Promise.all(
        openQuestions.map(async (q) => {
          try {
            const evalRes = await evaluateShortAnswerApi({
              question: q.question,
              expectedAnswer: q.correctAnswer,
              studentAnswer: userAnswers[q.id] || '',
            });
            nextEvals[q.id] = evalRes;
          } catch {
            // fallback to string check
          }
        })
      );
    }

    setAiEvaluations(nextEvals);
    setSubmitted(true);
    setEvaluatingSubmit(false);
    onCompleteQuiz();

    const { rawScore, finalScore } = computeScore(nextEvals);
    const total = activeQuiz.questions.length || 1;
    const scorePercent = Math.round((finalScore / total) * 100);
    const timeTakenSeconds = Math.max(0, timerMinutes * 60 - timeLeftSeconds);

    if (finalScore / total >= 0.7) {
      confetti({ particleCount: 80, spread: 80, origin: { y: 0.6 } });
    }

    onSubmitAttempt?.({
      quizSetId: activeQuiz.id,
      quizTitle: activeQuiz.title,
      score: finalScore,
      scorePercent,
      totalQuestions: total,
      correctCount: rawScore,
      timeTakenSeconds,
      answers: userAnswers,
    });
  };

  const handleReset = () => {
    setUserAnswers({});
    setAiEvaluations({});
    setSubmitted(false);
    setReviewMistakesOnly(false);
    setTimeLeftSeconds(timerMinutes * 60);
    setTimerRunning(false);
  };

  const handleGenerateAIQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loadingAI) return;

    let quizTopic = topic.trim();
    let sourceContent = '';
    let docIds: string[] | undefined;

    if (sourceMode === 'document') {
      const doc = sources.find((s) => s.id === selectedSourceId) || sources[0];
      if (!doc) {
        setErrorMsg('No source document found in this notebook.');
        return;
      }
      quizTopic = quizTopic || doc.title;
      sourceContent = doc.content;
      docIds = [doc.id];
    } else if (sourceMode === 'note') {
      const note = notes.find((n) => n.id === selectedNoteId) || notes[0];
      if (!note) {
        setErrorMsg('No study note found in this notebook.');
        return;
      }
      quizTopic = quizTopic || note.title;
      sourceContent = note.content;
    } else if (!quizTopic) {
      setErrorMsg('Please enter an exam topic.');
      return;
    }

    setLoadingAI(true);
    setErrorMsg('');
    try {
      const generatedQuestions = await generateAIQuiz(
        quizTopic,
        sourceContent,
        questionCount,
        difficulty,
        activeNotebookId,
        questionFormat,
        docIds
      );

      const newQuiz: QuizSet = {
        id: `qz-${Date.now()}`,
        notebookId: activeNotebookId,
        title: `${quizTopic} (${difficulty.toUpperCase()})`,
        description: `AI generated ${questionFormat} test for ${quizTopic}`,
        difficulty,
        createdAt: new Date().toISOString().split('T')[0],
        questions: generatedQuestions.map((q, idx) => ({
          id: `q-${Date.now()}-${idx}`,
          type: (q.type as QuizQuestion['type']) || 'multiple-choice',
          question: q.question || 'Question',
          options: Array.isArray(q.options) && q.options.length > 0 ? q.options : undefined,
          matchingPairs: Array.isArray(q.matchingPairs) && q.matchingPairs.length > 0 ? q.matchingPairs : undefined,
          correctAnswer: q.correctAnswer || '',
          explanation: q.explanation || 'Explanation grounded in your study sources.',
          sourceDocId: q.sourceDocId,
        })),
      };

      onAddQuizSet(newQuiz);
      setActiveQuizId(newQuiz.id);
      handleReset();
      setShowModal(false);
      setTopic('');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to generate practice test.');
    } finally {
      setLoadingAI(false);
    }
  };

  const { negativeDeductions, finalScore } = computeScore();
  const total = activeQuiz?.questions.length || 0;
  const scorePercent = total > 0 ? Math.round((finalScore / total) * 100) : 0;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const sortedAttempts = [...quizAttempts].sort(
    (a, b) => (b.scorePercent ?? 0) - (a.scorePercent ?? 0)
  );

  const averageAttemptPercent =
    quizAttempts.length > 0
      ? Math.round(
          quizAttempts.reduce(
            (sum, a) =>
              sum + (a.scorePercent ?? Math.round((a.score / Math.max(1, a.totalQuestions)) * 100)),
            0
          ) / quizAttempts.length
        )
      : 0;

  const displayedQuestions = (activeQuiz?.questions || []).filter((q) => {
    if (!submitted || !reviewMistakesOnly) return true;
    return !isQuestionCorrect(q);
  });

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-pink-500" /> Practice Tests & Exam Mode Engine
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Timed exams, negative marking, AI short-answer grading, mistake review, and score comparisons.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeQuiz && (
            <>
              <button
                type="button"
                onClick={() =>
                  exportToPrintablePdf(
                    activeQuiz.title,
                    activeQuiz.questions.map((q, idx) => ({
                      heading: `Q${idx + 1} (${q.type})`,
                      body: `${q.question}${
                        q.options?.length ? `\nOptions:\n- ${q.options.join('\n- ')}` : ''
                      }\nExpected Answer: ${q.correctAnswer}\nExplanation: ${q.explanation}`,
                    }))
                  )
                }
                className="px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" /> PDF
              </button>
              <button
                type="button"
                onClick={() =>
                  exportToDocx(
                    activeQuiz.title,
                    activeQuiz.title,
                    activeQuiz.questions.map((q, idx) => ({
                      heading: `Q${idx + 1}`,
                      body: `${q.question}${
                        q.options?.length ? `\nOptions: ${q.options.join(' | ')}` : ''
                      }\nAnswer: ${q.correctAnswer}\nExplanation: ${q.explanation}`,
                    }))
                  )
                }
                className="px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold"
              >
                DOCX
              </button>
              <button
                type="button"
                onClick={() =>
                  exportToCsv(
                    `${activeQuiz.title}_results`,
                    ['Type', 'Question', 'Correct Answer', 'Explanation'],
                    activeQuiz.questions.map((q) => [
                      q.type,
                      q.question,
                      q.correctAnswer,
                      q.explanation,
                    ])
                  )
                }
                className="px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold"
              >
                CSV
              </button>
              <button
                type="button"
                onClick={() =>
                  exportToMarkdown(
                    activeQuiz.title,
                    activeQuiz.title,
                    activeQuiz.questions.map((q, idx) => ({
                      heading: `Q${idx + 1}`,
                      body: `${q.question}\n\n- **Answer:** ${q.correctAnswer}\n- **Explanation:** ${q.explanation}`,
                    }))
                  )
                }
                className="px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold"
              >
                .MD
              </button>
              <button
                type="button"
                onClick={() =>
                  exportToJson(activeQuiz.title, { quiz: activeQuiz, attempts: quizAttempts })
                }
                className="px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold"
              >
                JSON
              </button>
            </>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4" /> Generate Test with AI
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('quiz')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'quiz'
                ? 'bg-pink-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <Brain className="w-4 h-4" /> Active Test
          </button>

          <button
            onClick={() => setActiveTab('bank')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'bank'
                ? 'bg-pink-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" /> Question Bank ({activeQuiz?.questions.length || 0})
          </button>

          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'leaderboard'
                ? 'bg-pink-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <Trophy className="w-4 h-4" /> Score History ({quizAttempts.length})
          </button>
        </div>

        {activeTab === 'quiz' && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setMode('practice')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  mode === 'practice'
                    ? 'bg-white dark:bg-slate-900 text-pink-600 font-bold shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                Practice Mode
              </button>
              <button
                onClick={() => setMode('exam')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  mode === 'exam'
                    ? 'bg-pink-600 text-white font-bold shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                Timed Exam Mode
              </button>
            </div>

            {mode === 'exam' && (
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1 font-bold text-amber-500">
                  <Timer className="w-4 h-4 animate-pulse" /> {formatTime(timeLeftSeconds)}
                </span>

                <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableNegativeMarking}
                    onChange={(e) => setEnableNegativeMarking(e.target.checked)}
                    className="accent-pink-600"
                  />
                  Negative Marking (-0.25)
                </label>
              </div>
            )}
          </div>
        )}
      </div>

      {activeTab === 'quiz' ? (
        <>
          <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800">
            {quizSets.map((quiz) => {
              const isSelected = quiz.id === (activeQuiz?.id || activeQuizId);
              return (
                <button
                  key={quiz.id}
                  onClick={() => {
                    setActiveQuizId(quiz.id);
                    handleReset();
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                    isSelected
                      ? 'bg-pink-500/10 border-pink-500 text-pink-700 dark:text-pink-400'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-400'
                  }`}
                >
                  {quiz.title} ({quiz.questions.length} Qs)
                </button>
              );
            })}
          </div>

          {activeQuiz ? (
            <div className="space-y-6">
              {submitted && (
                <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-6 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                      <Award className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">Quiz Completed!</h3>
                      <p className="text-xs text-slate-300">
                        Final Score: <strong className="text-pink-400">{finalScore}</strong> / {total} ({scorePercent}%)
                        {enableNegativeMarking && negativeDeductions > 0 && (
                          <span className="text-red-400 ml-2">(-{negativeDeductions} negative penalty)</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setReviewMistakesOnly((r) => !r)}
                      className={`px-3.5 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 border ${
                        reviewMistakesOnly
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                      }`}
                    >
                      <Filter className="w-3.5 h-3.5" />
                      <span>{reviewMistakesOnly ? 'Show All Questions' : 'Review Mistakes Only'}</span>
                    </button>

                    <button
                      onClick={handleReset}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow"
                    >
                      <RotateCcw className="w-4 h-4" /> Retake Test
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-6">
                {displayedQuestions.length === 0 && submitted && reviewMistakesOnly ? (
                  <div className="p-10 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-emerald-500 font-semibold">
                    Zero mistakes found on this test — great job!
                  </div>
                ) : (
                  displayedQuestions.map((q, idx) => {
                    const userAns = userAnswers[q.id];
                    const evalItem = aiEvaluations[q.id];
                    const isCorrect = isQuestionCorrect(q);
                    const showAnswerNow = mode === 'practice' ? Boolean(userAns && q.options?.length) || submitted : submitted;

                    return (
                      <div
                        key={q.id}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-bold text-pink-600 dark:text-pink-400">
                            Question {idx + 1}
                          </span>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                            {q.type}
                          </span>
                        </div>

                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-relaxed">
                          {q.question}
                        </h3>

                        {q.matchingPairs && q.matchingPairs.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                            {q.matchingPairs.map((pair, pIdx) => (
                              <div key={pIdx} className="flex items-center justify-between gap-2 px-2 py-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                                <span className="font-semibold text-indigo-500">{pair.left}</span>
                                <span className="text-slate-500">→ {pair.right}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {q.options && q.options.length > 0 ? (
                          <div className="grid grid-cols-1 gap-2">
                            {q.options.map((opt, optIdx) => {
                              const isSelected = userAns === opt;
                              const isRightAnswer = opt === q.correctAnswer;

                              let optClass =
                                'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200';

                              if (showAnswerNow) {
                                if (isRightAnswer) {
                                  optClass =
                                    'bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-400 font-bold';
                                } else if (isSelected && !isRightAnswer) {
                                  optClass =
                                    'bg-red-500/10 border-red-500 text-red-600 dark:text-red-400';
                                }
                              } else if (isSelected) {
                                optClass =
                                  'bg-pink-500/10 border-pink-500 text-pink-700 dark:text-pink-400 font-semibold';
                              }

                              return (
                                <button
                                  key={optIdx}
                                  onClick={() => handleSelectOption(q.id, opt)}
                                  className={`w-full text-left p-3.5 rounded-xl border text-xs transition-all flex items-center justify-between ${optClass}`}
                                >
                                  <span>{opt}</span>
                                  {showAnswerNow && isRightAnswer && (
                                    <Check className="w-4 h-4 text-emerald-500" />
                                  )}
                                  {showAnswerNow && isSelected && !isRightAnswer && (
                                    <XCircle className="w-4 h-4 text-red-500" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <textarea
                            rows={2}
                            disabled={submitted && mode === 'exam'}
                            placeholder={
                              q.type === 'fill-in-the-blank'
                                ? 'Type the missing term or phrase...'
                                : 'Type your short answer response (AI graded on submit)...'
                            }
                            value={userAns || ''}
                            onChange={(e) => handleSelectOption(q.id, e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-pink-500"
                          />
                        )}

                        {showAnswerNow && (
                          <div
                            className={`p-3.5 rounded-xl border text-xs leading-relaxed space-y-1.5 ${
                              isCorrect
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                                : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold">
                                {isCorrect ? 'Correct!' : `Expected Answer: "${q.correctAnswer}"`}
                              </span>
                              {evalItem && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                                  AI Score: {evalItem.scorePercent}%
                                </span>
                              )}
                            </div>
                            {evalItem?.feedback && (
                              <p className="font-medium text-indigo-300">{evalItem.feedback}</p>
                            )}
                            <p>{q.explanation}</p>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {!submitted && (
                <div className="flex justify-end pt-4">
                  <button
                    onClick={handleSubmitQuiz}
                    disabled={Object.keys(userAnswers).length === 0 || evaluatingSubmit}
                    className="px-6 py-3 bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-2"
                  >
                    {evaluatingSubmit && <Sparkles className="w-4 h-4 animate-spin" />}
                    <span>{evaluatingSubmit ? 'Grading Responses...' : 'Submit Practice Test'}</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <HelpCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-bold text-slate-800 dark:text-slate-200">
                No practice tests in this notebook yet
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Click Generate Test with AI to build a grounded exam.
              </p>
            </div>
          )}
        </>
      ) : activeTab === 'bank' ? (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Reusable Question Bank ({activeQuiz?.title || 'Select a test'})
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {activeQuiz?.questions.map((q, idx) => (
              <div
                key={q.id}
                className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-pink-600">
                    Q{idx + 1} ({q.type})
                  </span>
                  <span className="text-[10px] text-slate-400">Expected: {q.correctAnswer}</span>
                </div>
                <p className="font-semibold text-slate-800 dark:text-slate-200">{q.question}</p>
                <p className="text-[11px] text-slate-500 italic">{q.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" /> Personal Exam History & Attempt Comparison
            </h3>
            {quizAttempts.length > 0 && (
              <div className="flex items-center gap-3 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 font-bold flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> Avg: {averageAttemptPercent}%
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold">
                  Best: {sortedAttempts[0]?.scorePercent ?? 0}%
                </span>
              </div>
            )}
          </div>

          {sortedAttempts.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">
              Complete a practice test to record your score history and compare attempts here.
            </p>
          ) : (
            <div className="space-y-2">
              {sortedAttempts.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-6 h-6 rounded-full font-bold flex items-center justify-center text-xs ${
                        idx === 0
                          ? 'bg-amber-500 text-slate-950'
                          : idx === 1
                          ? 'bg-slate-300 text-slate-900'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-slate-100">
                        {item.quizTitle || 'Practice Exam'}
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        {item.correctCount}/{item.totalQuestions} correct •{' '}
                        {new Date(item.completedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-extrabold text-pink-600 dark:text-pink-400 text-sm block">
                      {item.scorePercent ??
                        Math.round((item.score / Math.max(1, item.totalQuestions)) * 100)}
                      %
                    </span>
                    {item.timeTakenSeconds !== undefined && (
                      <span className="text-[10px] text-slate-400">
                        {Math.floor(item.timeTakenSeconds / 60)}m {item.timeTakenSeconds % 60}s
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-pink-400" /> Generate Practice Exam with AI
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Build a custom exam from a topic, uploaded document, or study note.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-1.5 bg-slate-800 p-1 rounded-xl text-xs font-semibold">
              {(['topic', 'document', 'note'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSourceMode(m)}
                  className={`py-1.5 rounded-lg capitalize transition-all ${
                    sourceMode === m ? 'bg-pink-600 text-white font-bold' : 'text-slate-300'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <form onSubmit={handleGenerateAIQuiz} className="space-y-4">
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
                  {sourceMode === 'topic' ? 'Exam Subject / Topic' : 'Quiz Title (Optional override)'}
                </label>
                <input
                  type="text"
                  required={sourceMode === 'topic'}
                  placeholder="e.g. Transformer Architecture or Organic Chemistry"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Question Format
                  </label>
                  <select
                    value={questionFormat}
                    onChange={(e) => setQuestionFormat(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    {QUESTION_FORMATS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Questions
                  </label>
                  <select
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    {[3, 5, 8, 10, 15].map((c) => (
                      <option key={c} value={c}>
                        {c} Questions
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Difficulty
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Timer (Mins)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={timerMinutes}
                    onChange={(e) => setTimerMinutes(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
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
                  className="px-5 py-2.5 bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Sparkles className={`w-4 h-4 ${loadingAI ? 'animate-spin' : ''}`} />
                  <span>{loadingAI ? 'Generating Test...' : 'Generate Practice Test'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
