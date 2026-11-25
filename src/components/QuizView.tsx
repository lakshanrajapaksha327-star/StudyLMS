import React, { useState, useEffect } from 'react';
import {
  HelpCircle,
  Sparkles,
  CheckCircle2,
  XCircle,
  Award,
  RotateCcw,
  Plus,
  Brain,
  Check,
  AlertCircle,
  Timer,
  ShieldAlert,
  BarChart,
  Trophy,
  BookOpen,
  Eye,
  Sliders
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { QuizSet, QuizQuestion } from '../types';
import { generateAIQuiz } from '../services/api';

interface QuizViewProps {
  quizSets: QuizSet[];
  onAddQuizSet: (newSet: QuizSet) => void;
  onCompleteQuiz: () => void;
}

export const QuizView: React.FC<QuizViewProps> = ({
  quizSets,
  onAddQuizSet,
  onCompleteQuiz,
}) => {
  const [activeQuizId, setActiveQuizId] = useState<string>(quizSets[0]?.id || '');
  const activeQuiz = quizSets.find((q) => q.id === activeQuizId) || quizSets[0];

  const [activeTab, setActiveTab] = useState<'quiz' | 'bank' | 'leaderboard'>('quiz');

  // Quiz Configuration State
  const [mode, setMode] = useState<'practice' | 'exam'>('practice');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [enableNegativeMarking, setEnableNegativeMarking] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState<number>(10);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(10 * 60);
  const [timerRunning, setTimerRunning] = useState(false);

  // Quiz user state
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [topic, setTopic] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState([
    { rank: 1, name: 'Alex M.', score: '100%', speed: '3m 12s', streak: 12 },
    { rank: 2, name: 'Sarah K.', score: '95%', speed: '4m 05s', streak: 8 },
    { rank: 3, name: 'David L.', score: '90%', speed: '5m 30s', streak: 5 },
  ]);

  // Timer Countdown Effect
  useEffect(() => {
    let timer: any = null;
    if (timerRunning && timeLeftSeconds > 0 && !submitted) {
      timer = setInterval(() => {
        setTimeLeftSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleSubmitQuiz();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
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

  const handleCalculateScore = () => {
    if (!activeQuiz) return { rawScore: 0, negativeDeductions: 0, finalScore: 0 };
    let rawScore = 0;
    let negativeDeductions = 0;

    activeQuiz.questions.forEach((q) => {
      const ans = userAnswers[q.id]?.trim().toLowerCase();
      const correct = q.correctAnswer.trim().toLowerCase();
      if (ans) {
        if (ans === correct || (q.type === 'short-answer' && correct.includes(ans))) {
          rawScore += 1;
        } else if (enableNegativeMarking) {
          negativeDeductions += 0.25;
        }
      }
    });

    const finalScore = Math.max(0, rawScore - negativeDeductions);
    return { rawScore, negativeDeductions, finalScore };
  };

  const handleSubmitQuiz = () => {
    setSubmitted(true);
    setTimerRunning(false);
    onCompleteQuiz();

    const { finalScore } = handleCalculateScore();
    const total = activeQuiz?.questions.length || 1;
    if (finalScore / total >= 0.7) {
      confetti({ particleCount: 80, spread: 80, origin: { y: 0.6 } });
    }

    // Add to local leaderboard
    const newPercent = Math.round((finalScore / total) * 100);
    setLeaderboard((prev) => [
      ...prev,
      {
        rank: prev.length + 1,
        name: 'You (Current Session)',
        score: `${newPercent}%`,
        speed: `${Math.floor((timerMinutes * 60 - timeLeftSeconds) / 60)}m ${(timerMinutes * 60 - timeLeftSeconds) % 60}s`,
        streak: 1,
      },
    ]);
  };

  const handleReset = () => {
    setUserAnswers({});
    setSubmitted(false);
    setTimeLeftSeconds(timerMinutes * 60);
    setTimerRunning(false);
  };

  const handleGenerateAIQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || loadingAI) return;

    setLoadingAI(true);
    try {
      const generatedQuestions = await generateAIQuiz(topic, '', 4);

      const newQuiz: QuizSet = {
        id: `qz-${Date.now()}`,
        notebookId: 'nb-1',
        title: `${topic} (${difficulty.toUpperCase()}) Exam`,
        description: `AI generated practice exam for ${topic}`,
        createdAt: new Date().toISOString().split('T')[0],
        questions: generatedQuestions.map((q, idx) => ({
          id: `q-${Date.now()}-${idx}`,
          type: (q.type as any) || 'multiple-choice',
          question: q.question || 'Question',
          options: q.options || ['Option A', 'Option B', 'Option C', 'Option D'],
          correctAnswer: q.correctAnswer || 'Option A',
          explanation: q.explanation || 'Detailed explanation provided by AI.',
        })),
      };

      onAddQuizSet(newQuiz);
      setActiveQuizId(newQuiz.id);
      setUserAnswers({});
      setSubmitted(false);
      setShowModal(false);
      setTopic('');
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAI(false);
    }
  };

  const { rawScore, negativeDeductions, finalScore } = handleCalculateScore();
  const total = activeQuiz?.questions.length || 0;
  const scorePercent = total > 0 ? Math.round((finalScore / total) * 100) : 0;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-pink-500" /> Practice Tests & Exam Mode Engine
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Simulate timed exam conditions, negative marking, question banks, and instant practice feedback.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow flex items-center gap-1.5"
        >
          <Sparkles className="w-4 h-4" /> Generate Test with AI
        </button>
      </div>

      {/* Main View Mode Selector Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
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
            <Trophy className="w-4 h-4" /> Leaderboard & High Scores
          </button>
        </div>

        {/* Exam Controls Toggle Bar */}
        {activeTab === 'quiz' && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setMode('practice')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  mode === 'practice' ? 'bg-white dark:bg-slate-900 text-pink-600 font-bold shadow-xs' : 'text-slate-500'
                }`}
              >
                Practice Mode
              </button>
              <button
                onClick={() => setMode('exam')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  mode === 'exam' ? 'bg-pink-600 text-white font-bold shadow-xs' : 'text-slate-500'
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
          {/* Quiz Selector */}
          <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800">
            {quizSets.map((quiz) => {
              const isSelected = quiz.id === activeQuizId;
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
              {/* Quiz Scorecard Banner when submitted */}
              {submitted && (
                <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-6 border border-slate-800 flex items-center justify-between shadow-xl">
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

                  <button
                    onClick={handleReset}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow"
                  >
                    <RotateCcw className="w-4 h-4" /> Retake Test
                  </button>
                </div>
              )}

              {/* Question List */}
              <div className="space-y-6">
                {activeQuiz.questions.map((q, idx) => {
                  const userAns = userAnswers[q.id];
                  const isCorrect =
                    userAns?.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();

                  const showAnswerNow = mode === 'practice' ? !!userAns : submitted;

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

                      {/* Options for Multiple Choice or True/False */}
                      {q.options && q.options.length > 0 ? (
                        <div className="grid grid-cols-1 gap-2">
                          {q.options.map((opt, optIdx) => {
                            const isSelected = userAns === opt;
                            const isRightAnswer = opt === q.correctAnswer;

                            let optClass =
                              'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200';

                            if (showAnswerNow) {
                              if (isRightAnswer) {
                                optClass = 'bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-400 font-bold';
                              } else if (isSelected && !isRightAnswer) {
                                optClass = 'bg-red-500/10 border-red-500 text-red-600 dark:text-red-400';
                              }
                            } else if (isSelected) {
                              optClass = 'bg-pink-500/10 border-pink-500 text-pink-700 dark:text-pink-400 font-semibold';
                            }

                            return (
                              <button
                                key={optIdx}
                                onClick={() => handleSelectOption(q.id, opt)}
                                className={`w-full text-left p-3.5 rounded-xl border text-xs transition-all flex items-center justify-between ${optClass}`}
                              >
                                <span>{opt}</span>
                                {showAnswerNow && isRightAnswer && <Check className="w-4 h-4 text-emerald-500" />}
                                {showAnswerNow && isSelected && !isRightAnswer && <XCircle className="w-4 h-4 text-red-500" />}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        /* Short Answer Input */
                        <input
                          type="text"
                          disabled={submitted && mode === 'exam'}
                          placeholder="Type your short answer..."
                          value={userAns || ''}
                          onChange={(e) => handleSelectOption(q.id, e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-pink-500"
                        />
                      )}

                      {/* Explanation Block when Submitted or Practice Mode */}
                      {showAnswerNow && (
                        <div
                          className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                            isCorrect
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                              : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
                          }`}
                        >
                          <span className="font-bold block mb-1">
                            {isCorrect ? '✓ Correct!' : `✗ Correct Answer: "${q.correctAnswer}"`}
                          </span>
                          <p>{q.explanation}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {!submitted && (
                <div className="flex justify-end pt-4">
                  <button
                    onClick={handleSubmitQuiz}
                    disabled={Object.keys(userAnswers).length === 0}
                    className="px-6 py-3 bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-lg"
                  >
                    Submit Practice Test
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <HelpCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-bold text-slate-800 dark:text-slate-200">No practice tests available</h3>
            </div>
          )}
        </>
      ) : activeTab === 'bank' ? (
        /* Question Bank Tab */
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Reusable Question Bank</h3>
          <div className="grid grid-cols-1 gap-3">
            {activeQuiz?.questions.map((q, idx) => (
              <div key={q.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-pink-600">Q{idx + 1} ({q.type})</span>
                  <span className="text-[10px] text-slate-400">Correct: {q.correctAnswer}</span>
                </div>
                <p className="font-semibold text-slate-800 dark:text-slate-200">{q.question}</p>
                <p className="text-[11px] text-slate-500 italic">{q.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Leaderboard Tab */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" /> Exam Leaderboard & Active Recall Ranking
          </h3>

          <div className="space-y-2">
            {leaderboard.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-full font-bold flex items-center justify-center text-xs ${
                      item.rank === 1
                        ? 'bg-amber-500 text-slate-950'
                        : item.rank === 2
                        ? 'bg-slate-300 text-slate-900'
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {item.rank}
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-slate-100">{item.name}</h4>
                    <p className="text-[10px] text-slate-500">Streak: {item.streak} days</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-extrabold text-pink-600 dark:text-pink-400 text-sm block">{item.score}</span>
                  <span className="text-[10px] text-slate-400">Time: {item.speed}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Quiz Generator Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-pink-400" /> Generate Practice Exam with Gemini
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Create a custom practice exam with multiple choice, true/false, and short answer questions.
            </p>

            <form onSubmit={handleGenerateAIQuiz} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Exam Subject / Topic</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Organic Chemistry Stereochemistry or Transformer Architecture"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Difficulty</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Timer (Mins)</label>
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
                  {loadingAI ? <Sparkles className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
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

