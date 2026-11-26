import React, { useCallback, useEffect, useState } from 'react';
import {
  Brain,
  Sparkles,
  CalendarClock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Send,
  Trash2,
  Lightbulb,
} from 'lucide-react';
import {
  deleteTopicMasteryApi,
  fetchPersonalizedInsightsApi,
  fetchRevisionScheduleApi,
  fetchTopicMasteriesApi,
  rescheduleRevisionItemApi,
  runAdaptiveStepApi,
} from '../services/api';
import {
  ActiveTab,
  PersonalizedInsightsData,
  RevisionScheduleData,
  RevisionScheduleItem,
  TopicMasteryItem,
} from '../types';

interface AdaptiveTutorViewProps {
  activeNotebookId?: string;
  onNavigate?: (tab: ActiveTab) => void;
}

export const AdaptiveTutorView: React.FC<AdaptiveTutorViewProps> = ({
  activeNotebookId,
  onNavigate,
}) => {
  const [subTab, setSubTab] = useState<'insights' | 'tutor' | 'schedule'>('insights');
  const [insights, setInsights] = useState<PersonalizedInsightsData | null>(null);
  const [masteries, setMasteries] = useState<TopicMasteryItem[]>([]);
  const [schedule, setSchedule] = useState<RevisionScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiCoachingLoading, setAiCoachingLoading] = useState(false);
  const [error, setError] = useState('');

  // Adaptive Tutor Session State
  const [subjectInput, setSubjectInput] = useState('');
  const [topicInput, setTopicInput] = useState('');
  const [activeMasteryId, setActiveMasteryId] = useState<string | undefined>(undefined);
  const [stage, setStage] = useState(1);
  const [stepLoading, setStepLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<{
    misconceptionIdentified: string;
    simplerExplanation: string;
    extraExample: string;
    practicalAnalogy: string;
    checkQuestion: string;
    evaluationFeedback: string;
    understood: boolean;
    nextDifficulty: string;
  } | null>(null);
  const [studentReply, setStudentReply] = useState('');

  // Rescheduling state
  const [rescheduleTarget, setRescheduleTarget] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [ins, tm, sched] = await Promise.all([
        fetchPersonalizedInsightsApi(false),
        fetchTopicMasteriesApi(),
        fetchRevisionScheduleApi(),
      ]);
      setInsights(ins);
      setMasteries(tm);
      setSchedule(sched);
    } catch (err: any) {
      setError(err?.message || 'Could not load personalized learning data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleLoadAiCoaching = async () => {
    setAiCoachingLoading(true);
    setError('');
    try {
      const ins = await fetchPersonalizedInsightsApi(true);
      setInsights(ins);
    } catch (err: any) {
      setError(err?.message || 'AI coaching synthesis failed.');
    } finally {
      setAiCoachingLoading(false);
    }
  };

  const startAdaptivePractice = async (
    subj: string,
    top: string,
    masteryId?: string,
    overrideReply?: string
  ) => {
    if (!subj.trim() || !top.trim()) return;
    setStepLoading(true);
    setError('');
    try {
      const res = await runAdaptiveStepApi({
        topicMasteryId: masteryId,
        notebookId: activeNotebookId,
        subject: subj.trim(),
        topic: top.trim(),
        stage,
        studentResponse: overrideReply,
        checkQuestionAsked: currentStep?.checkQuestion,
      });
      setActiveMasteryId(res.topicMastery.id);
      setCurrentStep(res.step);
      setMasteries((prev) => {
        const idx = prev.findIndex((m) => m.id === res.topicMastery.id);
        if (idx === -1) return [res.topicMastery, ...prev];
        return prev.map((m) => (m.id === res.topicMastery.id ? res.topicMastery : m));
      });
      if (overrideReply) {
        setStage((s) => Math.min(7, s + 1));
        setStudentReply('');
      } else {
        setStage(1);
      }
      setSubTab('tutor');
    } catch (err: any) {
      setError(err?.message || 'Adaptive tutor step failed.');
    } finally {
      setStepLoading(false);
    }
  };

  const handleDeleteMastery = async (id: string) => {
    try {
      await deleteTopicMasteryApi(id);
      setMasteries((prev) => prev.filter((m) => m.id !== id));
      if (activeMasteryId === id) {
        setActiveMasteryId(undefined);
        setCurrentStep(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to delete topic mastery record.');
    }
  };

  const handleReschedule = async (item: RevisionScheduleItem) => {
    if (!rescheduleDate || item.sourceType === 'quiz_weakness') return;
    try {
      await rescheduleRevisionItemApi({
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        newDate: rescheduleDate,
      });
      setRescheduleTarget(null);
      const updatedSched = await fetchRevisionScheduleApi();
      setSchedule(updatedSched);
    } catch (err: any) {
      setError(err?.message || 'Failed to reschedule item.');
    }
  };

  const renderScheduleBucket = (
    title: string,
    items: RevisionScheduleItem[],
    badgeClass: string
  ) => (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</h3>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${badgeClass}`}>
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400 py-4 text-center">No items in this bucket.</p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {items.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 dark:text-white truncate">
                    {item.title}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {item.subject} • Due {item.dueDate} • {item.difficulty}
                  </div>
                  <div className="text-[11px] text-slate-400">{item.details}</div>
                </div>
                <span className="font-extrabold text-indigo-500 shrink-0">
                  {item.masteryPercent}%
                </span>
              </div>

              {item.reschedulable && (
                <div className="flex items-center gap-2">
                  {rescheduleTarget === item.id ? (
                    <>
                      <input
                        type="date"
                        value={rescheduleDate}
                        onChange={(e) => setRescheduleDate(e.target.value)}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-[11px]"
                      />
                      <button
                        type="button"
                        onClick={() => handleReschedule(item)}
                        className="px-2 py-1 bg-indigo-600 text-white rounded-lg text-[11px] font-bold"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setRescheduleTarget(null)}
                        className="text-[11px] text-slate-400"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setRescheduleTarget(item.id);
                        setRescheduleDate(item.dueDate);
                      }}
                      className="text-[11px] font-semibold text-indigo-500 hover:underline"
                    >
                      Reschedule Date
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Brain className="w-6 h-6 text-indigo-500" /> Personalized Learning, Adaptive Tutor & Revision
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Evidence-based recommendations from your actual quiz attempts, flashcards, study sessions, and 7-stage adaptive mastery coaching.
          </p>
        </div>

        <div className="flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl text-xs font-bold">
          {(
            [
              { id: 'insights', label: 'Personalized Insights' },
              { id: 'tutor', label: 'Adaptive Tutor' },
              { id: 'schedule', label: 'Smart Revision' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`px-3.5 py-1.5 rounded-lg transition-colors ${
                subTab === t.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs rounded-xl">
          {error}
        </div>
      )}

      {loading && !insights ? (
        <div className="h-44 rounded-2xl bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
      ) : null}

      {/* TAB 1: PERSONALIZED INSIGHTS */}
      {subTab === 'insights' && insights && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-500 uppercase tracking-wider">
                <TrendingUp className="w-4 h-4" /> Real History Diagnostics
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {insights.headlineInsight ||
                  (insights.hasHistory
                    ? `Tracking ${insights.totals.quizAttemptsCount} quiz attempt(s), ${insights.totals.flashcardsTotal} flashcard(s), ${insights.totals.studyMinutesTotal} active study min, and ${insights.totals.topicsTracked} adaptive topic(s).`
                    : 'No study history recorded yet. All metrics shown below reflect your actual cloud workspace records.')}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLoadAiCoaching}
              disabled={aiCoachingLoading}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shrink-0"
            >
              <Sparkles className={`w-4 h-4 ${aiCoachingLoading ? 'animate-spin' : ''}`} />
              <span>{aiCoachingLoading ? 'Analyzing History...' : 'Generate AI Coaching'}</span>
            </button>
          </div>

          {/* Actionable Recommendations */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {insights.recommendations.map((rec, i) => (
              <div
                key={i}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      rec.priority === 'high'
                        ? 'bg-rose-500/15 text-rose-500'
                        : rec.priority === 'medium'
                        ? 'bg-amber-500/15 text-amber-500'
                        : 'bg-emerald-500/15 text-emerald-500'
                    }`}
                  >
                    {rec.priority} priority
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{rec.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{rec.reason}</p>
                </div>
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => {
                      if (rec.targetTab === 'adaptive') setSubTab('tutor');
                      else if (rec.targetTab === 'quizzes') onNavigate('quiz');
                      else if (rec.targetTab === 'notebook') onNavigate('notebooklm');
                      else if (rec.targetTab === 'flashcards') onNavigate('flashcards');
                      else onNavigate('dashboard');
                    }}
                    className="text-xs font-bold text-indigo-500 hover:underline flex items-center gap-1"
                  >
                    <span>{rec.actionLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Weak & Strong Subjects */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Weak vs Strong Subjects
              </h3>
              {insights.weakSubjects.length === 0 && insights.strongSubjects.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  Complete quizzes or adaptive topic check-ins to populate subject strength profiles.
                </p>
              ) : (
                <div className="space-y-2.5 text-xs">
                  {insights.weakSubjects.map((w, idx) => (
                    <div
                      key={`w-${idx}`}
                      className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{w.subject}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {w.reason}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSubjectInput(w.subject);
                          setTopicInput(w.subject);
                          startAdaptivePractice(w.subject, w.subject);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold shrink-0"
                      >
                        Practice
                      </button>
                    </div>
                  ))}
                  {insights.strongSubjects.map((s, idx) => (
                    <div
                      key={`s-${idx}`}
                      className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{s.subject}</div>
                        <div className="text-[11px] text-emerald-500 font-semibold">
                          Strong performance ({s.avgScore ?? s.avgMastery}%)
                        </div>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Frequently Incorrect Questions & Difficult Concepts */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Recurring Mistakes & Difficult Concepts
              </h3>
              {insights.frequentlyIncorrectAnswers.length === 0 &&
              insights.difficultConcepts.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  No missed quiz questions or struggling concepts recorded yet.
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto text-xs">
                  {insights.difficultConcepts.map((dc) => (
                    <div
                      key={dc.id}
                      className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white truncate">
                          {dc.topic} ({dc.subject})
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Mastery {dc.masteryLevel}% {dc.struggleNotes ? `• ${dc.struggleNotes}` : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSubjectInput(dc.subject);
                          setTopicInput(dc.topic);
                          startAdaptivePractice(dc.subject, dc.topic, dc.id);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold shrink-0"
                      >
                        Drill
                      </button>
                    </div>
                  ))}
                  {insights.frequentlyIncorrectAnswers.map((fi, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800"
                    >
                      <span className="text-[10px] font-bold text-pink-500 block">
                        Missed in {fi.subject}
                      </span>
                      <span className="text-slate-700 dark:text-slate-200">{fi.question}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ADAPTIVE AI TUTOR */}
      {subTab === 'tutor' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                startAdaptivePractice(subjectInput, topicInput);
              }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3"
            >
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500" /> Start Adaptive Mastery Loop
              </h2>
              <input
                type="text"
                required
                value={subjectInput}
                onChange={(e) => setSubjectInput(e.target.value)}
                placeholder="Subject (e.g. Calculus)"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
              />
              <input
                type="text"
                required
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                placeholder="Topic you find tricky (e.g. Integration by Parts)"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
              />
              <button
                type="submit"
                disabled={stepLoading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl"
              >
                {stepLoading ? 'Adapting...' : 'Begin Adaptive Explanation'}
              </button>
            </form>

            {/* Topic Mastery Tracker */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Tracked Topic Mastery ({masteries.length})
              </h3>
              {masteries.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  Start an adaptive topic above to track mastery over time.
                </p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {masteries.map((tm) => (
                    <div
                      key={tm.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSubjectInput(tm.subject);
                            setTopicInput(tm.topic);
                            startAdaptivePractice(tm.subject, tm.topic, tm.id);
                          }}
                          className="font-bold text-slate-900 dark:text-white text-left truncate hover:text-indigo-500"
                        >
                          {tm.topic}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMastery(tm.id)}
                          aria-label={`Delete topic ${tm.topic}`}
                          className="text-slate-400 hover:text-rose-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>
                          {tm.subject} • {tm.difficultyLevel} • {tm.status}
                        </span>
                        <span className="font-bold text-indigo-500">{tm.masteryLevel}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${tm.masteryLevel}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 7-Stage Adaptive Dialogue */}
          <div className="lg:col-span-2">
            {currentStep ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                      Adaptive Stage {stage} • Next Tier: {currentStep.nextDifficulty}
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      {topicInput} ({subjectInput})
                    </h3>
                  </div>
                </div>

                {currentStep.evaluationFeedback && (
                  <div
                    className={`p-3.5 rounded-xl border text-xs ${
                      currentStep.understood
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    }`}
                  >
                    <strong>Tutor Feedback:</strong> {currentStep.evaluationFeedback}
                  </div>
                )}

                <div className="space-y-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                    <strong className="text-indigo-500 block mb-1">1. Core Struggle Focus</strong>
                    <p className="text-slate-700 dark:text-slate-200">
                      {currentStep.misconceptionIdentified}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                    <strong className="text-emerald-500 block mb-1">2. Simpler Explanation</strong>
                    <p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                      {currentStep.simplerExplanation}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                      <strong className="text-amber-500 block mb-1">3. Concrete Example</strong>
                      <p className="text-slate-700 dark:text-slate-200">
                        {currentStep.extraExample}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                      <strong className="text-pink-500 block mb-1">4. Practical Analogy</strong>
                      <p className="text-slate-700 dark:text-slate-200">
                        {currentStep.practicalAnalogy}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 space-y-3">
                    <strong className="text-indigo-400 block">5. Check Your Understanding</strong>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {currentStep.checkQuestion}
                    </p>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!studentReply.trim()) return;
                        startAdaptivePractice(
                          subjectInput,
                          topicInput,
                          activeMasteryId,
                          studentReply.trim()
                        );
                      }}
                      className="flex gap-2"
                    >
                      <input
                        type="text"
                        value={studentReply}
                        onChange={(e) => setStudentReply(e.target.value)}
                        placeholder="Type your answer to test mastery..."
                        className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                      />
                      <button
                        type="submit"
                        disabled={stepLoading || !studentReply.trim()}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{stepLoading ? 'Evaluating...' : 'Submit'}</span>
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
                <Brain className="w-12 h-12 text-slate-300 mx-auto" />
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  Adaptive 7-Stage Coaching
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Pick a weak subject or enter any concept on the left. StudyLMS breaks it into simpler terms, an analogy, an example, and checks understanding before advancing difficulty.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: UNIFIED SMART REVISION SCHEDULE */}
      {subTab === 'schedule' && schedule && (
        <div className="space-y-5">
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <CalendarClock className="w-4 h-4 text-indigo-500" />
              <span>Unified Spaced Repetition & Revision Queue (Today: {schedule.today})</span>
            </div>
            <div className="flex flex-wrap gap-3 text-[11px]">
              <span className="text-rose-500 font-bold">Overdue: {schedule.counts.overdue}</span>
              <span className="text-amber-500 font-bold">Due Today: {schedule.counts.dueToday}</span>
              <span className="text-indigo-500 font-bold">Upcoming: {schedule.counts.upcoming}</span>
              <span className="text-emerald-500 font-bold">Completed: {schedule.counts.completed}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {renderScheduleBucket('Overdue', schedule.overdue, 'bg-rose-500/15 text-rose-500')}
            {renderScheduleBucket('Due Today', schedule.dueToday, 'bg-amber-500/15 text-amber-500')}
            {renderScheduleBucket('Upcoming', schedule.upcoming, 'bg-indigo-500/15 text-indigo-500')}
            {renderScheduleBucket('Completed', schedule.completed, 'bg-emerald-500/15 text-emerald-500')}
          </div>
        </div>
      )}
    </div>
  );
};
