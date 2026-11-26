import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Clock,
  Flame,
  TrendingUp,
  Layers,
  Award,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import {
  deleteStudySessionApi,
  fetchLearningAnalyticsApi,
  fetchStudySessionsApi,
} from '../services/api';
import { ActiveTab, LearningAnalyticsData, StudySessionItem } from '../types';

interface AnalyticsViewProps {
  onNavigate?: (tab: ActiveTab) => void;
  refreshSignal?: number;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ onNavigate, refreshSignal }) => {
  const [range, setRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [analytics, setAnalytics] = useState<LearningAnalyticsData | null>(null);
  const [sessions, setSessions] = useState<StudySessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAnalytics = useCallback(async (selectedRange: '7d' | '30d' | '90d' | 'all') => {
    setLoading(true);
    setError('');
    try {
      const [data, recentSessions] = await Promise.all([
        fetchLearningAnalyticsApi(selectedRange),
        fetchStudySessionsApi().catch(() => []),
      ]);
      setAnalytics(data);
      setSessions(recentSessions);
    } catch (err: any) {
      setError(err?.message || 'Failed to load learning analytics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics(range);
  }, [range, refreshSignal, loadAnalytics]);

  const handleDeleteSession = async (id: string) => {
    try {
      await deleteStudySessionApi(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      await loadAnalytics(range);
    } catch (err: any) {
      setError(err?.message || 'Could not remove study session.');
    }
  };

  const maxDailyMins = Math.max(
    10,
    ...(analytics?.dailyStudy.map((d) => d.minutes) || [0])
  );

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-500" /> Learning Analytics & Consistency
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real metrics aggregated from your recorded study sessions, quiz attempts, flashcards, and topic mastery.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 text-xs font-semibold">
            {(['7d', '30d', '90d', 'all'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`px-3 py-1 rounded-lg uppercase transition-colors ${
                  range === r
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => loadAnalytics(range)}
            aria-label="Refresh analytics"
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-indigo-500"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs rounded-xl">
          {error}
        </div>
      )}

      {loading && !analytics ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((k) => (
            <div
              key={k}
              className="h-28 rounded-2xl bg-slate-200/70 dark:bg-slate-800/70 animate-pulse"
            />
          ))}
        </div>
      ) : analytics ? (
        <>
          {/* Summary KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Active Study Time</span>
                <Clock className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {analytics.summary.totalStudyHours}h
              </div>
              <div className="text-[11px] text-slate-400">
                {analytics.summary.totalStudyMinutes} min • {analytics.summary.sessionsCount} session(s)
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Average Quiz Score</span>
                <Award className="w-4 h-4 text-pink-500" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {analytics.summary.avgQuizScore !== null ? `${analytics.summary.avgQuizScore}%` : '—'}
              </div>
              <div className="text-[11px] text-slate-400">
                {analytics.summary.quizzesCompleted} quiz attempt(s)
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Flashcard Mastery</span>
                <Layers className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {analytics.summary.flashcardMasteryPercent !== null
                  ? `${analytics.summary.flashcardMasteryPercent}%`
                  : '—'}
              </div>
              <div className="text-[11px] text-slate-400">
                {analytics.summary.masteredCards} / {analytics.summary.totalCards} cards mastered
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Revision Completion</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {analytics.summary.revisionCompletionRate !== null
                  ? `${analytics.summary.revisionCompletionRate}%`
                  : '—'}
              </div>
              <div className="text-[11px] text-slate-400">
                {analytics.summary.topicsTracked} adaptive topic(s)
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Study Consistency</span>
                <Flame className="w-4 h-4 text-orange-500" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {analytics.summary.streakDays}d
              </div>
              <div className="text-[11px] text-slate-400">Active day streak</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Study Minutes Bar Chart */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Daily Active Study Minutes
                </h2>
                <span className="text-[11px] text-slate-400 uppercase">{range}</span>
              </div>

              {analytics.dailyStudy.every((d) => d.minutes === 0) ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No recorded study sessions in this range yet. Use the timer in the top bar to log focus sessions.
                </div>
              ) : (
                <div className="flex items-end gap-1.5 h-44 pt-4 overflow-x-auto">
                  {analytics.dailyStudy.map((d) => {
                    const heightPct = Math.max(4, Math.round((d.minutes / maxDailyMins) * 100));
                    return (
                      <div
                        key={d.date}
                        className="flex-1 min-w-[14px] flex flex-col items-center gap-1 group"
                        title={`${d.date}: ${d.minutes} min (${d.sessionsCount} session)`}
                      >
                        <span className="text-[9px] font-bold text-indigo-400 opacity-0 group-hover:opacity-100">
                          {d.minutes}m
                        </span>
                        <div className="w-full h-32 flex items-end justify-center bg-slate-100 dark:bg-slate-800/50 rounded-md overflow-hidden">
                          <div
                            className={`w-full rounded-t-md transition-all ${
                              d.minutes > 0 ? 'bg-indigo-500' : 'bg-transparent'
                            }`}
                            style={{ height: `${d.minutes > 0 ? heightPct : 0}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-slate-400 rotate-0">
                          {d.date.slice(5)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quiz Score Trend */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-pink-500" /> Quiz Score Trend
                </h2>
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate('quiz')}
                    className="text-xs font-semibold text-pink-500 hover:underline"
                  >
                    Take Quiz
                  </button>
                )}
              </div>

              {analytics.quizTrend.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No quiz attempts logged in this period yet. Complete a practice test to track improvement.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                  {analytics.quizTrend.map((q) => (
                    <div key={q.attemptId} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[70%]">
                          {q.title}
                        </span>
                        <span className="font-bold text-pink-500">
                          {q.scorePercent}% • {q.date}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            q.scorePercent >= 75
                              ? 'bg-emerald-500'
                              : q.scorePercent >= 50
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(2, q.scorePercent))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Subject-wise Performance */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Subject Performance
              </h2>
              {analytics.subjectPerformance.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  No subject data recorded yet.
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {analytics.subjectPerformance.map((sp) => (
                    <div
                      key={sp.subject}
                      className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-bold text-slate-800 dark:text-slate-100 truncate">
                          {sp.subject}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {sp.studyMinutes}m studied • {sp.quizAttempts} quiz(zes)
                        </div>
                      </div>
                      <span className="font-extrabold text-indigo-500 shrink-0">
                        {sp.avgQuizScore !== null ? `${sp.avgQuizScore}%` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Weak Areas Breakdown */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Weak Areas
                </h2>
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate('adaptive')}
                    className="text-xs font-semibold text-indigo-500 hover:underline"
                  >
                    Practice
                  </button>
                )}
              </div>
              {analytics.weakAreas.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  No struggling topics detected. Track topics in Adaptive Tutor to monitor mastery.
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {analytics.weakAreas.map((w) => (
                    <div
                      key={w.id}
                      className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                          {w.topic}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {w.subject} • {w.difficultyLevel}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-500 font-bold">
                        {w.masteryLevel}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Logged Study Sessions */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Recent Study Sessions
              </h2>
              {sessions.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  Start the header Study Timer to log real focus sessions.
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {sessions.slice(0, 10).map((s) => (
                    <div
                      key={s.id}
                      className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                          {s.subject}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {Math.max(1, Math.round(s.activeDurationSeconds / 60))}m active •{' '}
                          {new Date(s.startedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteSession(s.id)}
                        aria-label={`Delete study session ${s.subject}`}
                        className="p-1 text-slate-400 hover:text-rose-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
