import React, { useState, useMemo } from 'react';
import {
  FileText,
  Sparkles,
  Flame,
  CheckCircle2,
  ArrowRight,
  Zap,
  GraduationCap,
  Calendar,
  Target,
  CheckSquare,
  Plus,
  Trash2,
  Notebook as NotebookIcon,
  Layers,
  BookOpen,
  BarChart3,
  AlertTriangle,
  History,
} from 'lucide-react';
import {
  ActiveTab,
  Notebook,
  SourceDocument,
  NoteItem,
  FlashcardSet,
  QuizSet,
  QuizAttemptItem,
  StudyStats,
  StudyTaskItem,
  HistoryLogItem,
} from '../types';

interface DashboardViewProps {
  setActiveTab: (tab: ActiveTab) => void;
  activeNotebook: Notebook | undefined;
  notebooksCount?: number;
  sources: SourceDocument[];
  notes: NoteItem[];
  flashcardSets: FlashcardSet[];
  quizSets: QuizSet[];
  quizAttempts?: QuizAttemptItem[];
  stats: StudyStats;
  dailyGoalMinutes?: number;
  tasks?: StudyTaskItem[];
  onAddTask?: (title: string) => void;
  onToggleTask?: (id: string) => void;
  onDeleteTask?: (id: string) => void;
  studyPlans?: any[];
  historyLogs?: HistoryLogItem[];
  onQuickPromptChat: (prompt: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  setActiveTab,
  activeNotebook,
  notebooksCount = 1,
  sources,
  notes,
  flashcardSets,
  quizSets,
  quizAttempts = [],
  stats,
  dailyGoalMinutes = 60,
  tasks = [],
  onAddTask,
  onToggleTask,
  onDeleteTask,
  studyPlans = [],
  historyLogs = [],
  onQuickPromptChat,
}) => {
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    onAddTask?.(newTaskTitle.trim());
    setNewTaskTitle('');
  };

  const quickPrompts = [
    'Generate an executive summary of my uploaded documents.',
    'Create 5 high-yield exam questions based on my current notebook sources.',
    'Explain the single hardest concept in simple terms with analogies.',
    'Extract key formulas or technical definitions into a cheat sheet.',
  ];

  // Computed workspace totals
  const allCards = useMemo(() => flashcardSets.flatMap((s) => s.cards || []), [flashcardSets]);
  const masteredCardsCount = useMemo(
    () => allCards.filter((c) => c.status === 'mastered').length,
    [allCards]
  );
  const masteryPercent = allCards.length > 0 ? Math.round((masteredCardsCount / allCards.length) * 100) : 0;

  const avgQuizPercent = useMemo(() => {
    if (quizAttempts.length === 0) return null;
    const sum = quizAttempts.reduce(
      (acc, a) => acc + (a.scorePercent ?? Math.round((a.score / Math.max(1, a.totalQuestions)) * 100)),
      0
    );
    return Math.round(sum / quizAttempts.length);
  }, [quizAttempts]);

  // Real 28-day heatmap & 7-day weekly bar graph from activity logs
  const { heatmapDays, weeklyBars } = useMemo(() => {
    const countsByDay = new Map<string, number>();
    historyLogs.forEach((log) => {
      const parsed = new Date(log.timestamp);
      if (!isNaN(parsed.getTime())) {
        const key = parsed.toISOString().split('T')[0];
        countsByDay.set(key, (countsByDay.get(key) || 0) + 1);
      }
    });

    const today = new Date();
    const days28 = Array.from({ length: 28 }, (_, idx) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (27 - idx));
      const key = d.toISOString().split('T')[0];
      const count = countsByDay.get(key) || 0;
      const level = count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : count <= 4 ? 3 : 4;
      return {
        date: key,
        label: d.toLocaleDateString(undefined, { weekday: 'short' }),
        count,
        level,
      };
    });

    const last7 = days28.slice(-7);
    const maxCount = Math.max(1, ...last7.map((d) => d.count));
    const bars = last7.map((d) => ({
      ...d,
      heightPercent: d.count > 0 ? Math.max(18, Math.round((d.count / maxCount) * 100)) : 6,
    }));

    return { heatmapDays: days28, weeklyBars: bars };
  }, [historyLogs]);

  // Weak topics derived from low quiz scores (<70%) and difficult flashcards
  const weakAreas = useMemo(() => {
    const items: Array<{ label: string; reason: string; targetTab: ActiveTab }> = [];
    const lowAttempts = quizAttempts.filter((a) => (a.scorePercent ?? 100) < 70);
    lowAttempts.slice(0, 3).forEach((a) => {
      items.push({
        label: a.quizTitle || 'Practice Quiz',
        reason: `Scored ${a.scorePercent ?? 0}% (${a.correctCount}/${a.totalQuestions})`,
        targetTab: 'quiz',
      });
    });

    flashcardSets.forEach((set) => {
      const hardCount = (set.cards || []).filter(
        (c) => c.difficult || c.status === 'learning' || (c.easeFactor ?? 2.5) < 2.2
      ).length;
      if (hardCount > 0 && items.length < 4) {
        items.push({
          label: set.title,
          reason: `${hardCount} difficult / Box 1 card(s) due`,
          targetTab: 'flashcards',
        });
      }
    });

    return items;
  }, [quizAttempts, flashcardSets]);

  // Extract upcoming exams from studyPlans
  const upcomingExams = useMemo(() => {
    const now = Date.now();
    return studyPlans
      .filter((p) => p?.examDate)
      .map((p) => {
        const examMs = new Date(p.examDate).getTime();
        const daysLeft = Math.max(0, Math.ceil((examMs - now) / (1000 * 60 * 60 * 24)));
        return {
          id: p.id,
          title: p.title || (Array.isArray(p.subjects) ? p.subjects.join(', ') : 'Upcoming Exam'),
          date: p.examDate,
          daysLeft,
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 4);
  }, [studyPlans]);

  // Dynamic AI study recommendation based on actual workspace state
  const aiRecommendation = useMemo(() => {
    if (weakAreas.length > 0) {
      return {
        title: `Focus Today: ${weakAreas[0].label}`,
        subtitle: `${weakAreas[0].reason}. Targeted practice will improve your retention quickly.`,
        ctaLabel: weakAreas[0].targetTab === 'quiz' ? 'Retake Quiz' : 'Review Difficult Cards',
        targetTab: weakAreas[0].targetTab,
      };
    }
    if (sources.length === 0) {
      return {
        title: 'Get Started with Grounded AI Study',
        subtitle:
          'Upload a PDF, DOCX, PowerPoint, or handwritten note image to unlock RAG chat citations and quizzes.',
        ctaLabel: 'Upload First Source',
        targetTab: 'notebooklm' as ActiveTab,
      };
    }
    if (quizSets.length === 0) {
      return {
        title: 'Test Your Recall on Indexed Sources',
        subtitle: `You have ${sources.length} source(s) indexed. Generate a timed practice exam to benchmark your readiness.`,
        ctaLabel: 'Generate Practice Test',
        targetTab: 'quiz' as ActiveTab,
      };
    }
    return {
      title: `Keep Momentum in ${activeNotebook?.title || 'Active Notebook'}`,
      subtitle: `${sources.length} source(s), ${notes.length} note(s), and ${flashcardSets.length} flashcard deck(s) synced.`,
      ctaLabel: 'Open AI Study Tutor',
      targetTab: 'chat' as ActiveTab,
    };
  }, [weakAreas, sources, quizSets, notes, flashcardSets, activeNotebook]);

  const studiedMinutes = stats.timeSpentMinutes || 0;
  const targetPercent = Math.min(100, Math.round((studiedMinutes / Math.max(1, dailyGoalMinutes)) * 100));

  const getLevelBg = (level: number) => {
    switch (level) {
      case 0:
        return 'bg-slate-200 dark:bg-slate-800';
      case 1:
        return 'bg-emerald-900/40 border border-emerald-800/40';
      case 2:
        return 'bg-emerald-700/60';
      case 3:
        return 'bg-emerald-500';
      case 4:
        return 'bg-emerald-400 font-bold shadow-xs';
      default:
        return 'bg-slate-200 dark:bg-slate-800';
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Welcome Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 text-white border border-slate-800 shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold mb-4">
            <Flame className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> {stats.studyStreakDays} Day Active Study Streak
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
            Welcome back to{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-indigo-300 to-pink-300">
              {activeNotebook?.title || 'Study Assistant'}
            </span>
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed mb-6">
            Synthesize documents with grounded RAG citations, chat with your AI tutor, organize smart notes, and practice SM-2 flashcards.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setActiveTab('planner')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-slate-950 font-bold text-xs transition-all shadow-lg"
            >
              <Calendar className="w-4 h-4" />
              <span>AI Study Planner</span>
            </button>
            <button
              onClick={() => setActiveTab('notebooklm')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition-all"
            >
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Upload Study Documents</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic AI Recommendation Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl font-bold shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300">
              {aiRecommendation.title}
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              {aiRecommendation.subtitle}
            </p>
          </div>
        </div>

        <button
          onClick={() => setActiveTab(aiRecommendation.targetTab)}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow shrink-0"
        >
          {aiRecommendation.ctaLabel}
        </button>
      </div>

      {/* Workspace KPI Counters (Real Computed Metrics) */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Study Logged</span>
            <Target className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {studiedMinutes} / {dailyGoalMinutes} <span className="text-[11px] font-normal text-slate-400">m</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full transition-all" style={{ width: `${targetPercent}%` }} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Notebooks</span>
            <BookOpen className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{notebooksCount}</div>
          <p className="text-[10px] text-slate-400 mt-1">Workspaces</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Documents</span>
            <FileText className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{sources.length}</div>
          <p className="text-[10px] text-slate-400 mt-1">RAG Indexed</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Study Notes</span>
            <NotebookIcon className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{notes.length}</div>
          <p className="text-[10px] text-slate-400 mt-1">Smart Notes</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Flashcards</span>
            <Layers className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {allCards.length} <span className="text-xs text-emerald-500">({masteryPercent}%)</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">{masteredCardsCount} mastered</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Quiz Avg</span>
            <GraduationCap className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {avgQuizPercent !== null ? `${avgQuizPercent}%` : '—'}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            {quizAttempts.length} attempt(s) • {quizSets.length} quiz set(s)
          </p>
        </div>
      </div>

      {/* Weekly Chart + Heatmap + Upcoming Exams */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-xs">
          {/* Weekly Activity Bar Graph */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5 font-bold">
                <BarChart3 className="w-3.5 h-3.5 text-indigo-500" /> Weekly Activity (Last 7 Days)
              </span>
              <span className="text-[10px]">
                {weeklyBars.reduce((acc, b) => acc + b.count, 0)} logged study event(s)
              </span>
            </div>
            <div className="grid grid-cols-7 gap-2 h-24 items-end px-2 pt-3 pb-1 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-200 dark:border-slate-800">
              {weeklyBars.map((bar) => (
                <div key={bar.date} className="flex flex-col items-center justify-end h-full gap-1">
                  <div
                    className="w-full max-w-[28px] rounded-t-md bg-indigo-500/80 hover:bg-indigo-400 transition-all"
                    style={{ height: `${bar.heightPercent}%` }}
                    title={`${bar.date}: ${bar.count} action(s)`}
                  />
                  <span className="text-[9px] text-slate-400 font-medium">{bar.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 4-Week Heatmap */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5 font-bold">
                <Calendar className="w-3.5 h-3.5 text-emerald-500" /> Study Activity Heatmap (Past 4 Weeks)
              </span>
              <span className="text-[10px]">Less ▪ ▪ ▪ ▪ More</span>
            </div>
            <div className="grid grid-cols-7 gap-1.5 p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800">
              {heatmapDays.map((d) => (
                <div
                  key={d.date}
                  className={`h-7 rounded-md transition-all ${getLevelBg(d.level)}`}
                  title={`${d.date}: ${d.count} study action(s)`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Upcoming Exams & Weak Subjects */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-500" /> Upcoming Exams
            </h3>
            {upcomingExams.length === 0 ? (
              <div className="py-3 text-xs text-slate-400 space-y-2">
                <p>No exam dates scheduled yet.</p>
                <button
                  onClick={() => setActiveTab('planner')}
                  className="text-indigo-500 font-semibold hover:underline"
                >
                  + Add exam date in AI Study Planner
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingExams.map((ex) => (
                  <div
                    key={ex.id}
                    className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 truncate">{ex.title}</h4>
                      <span className="text-[10px] text-slate-400">{ex.date}</span>
                    </div>
                    <span className="font-extrabold text-amber-500 shrink-0">{ex.daysLeft}d left</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" /> Areas Needing Review
            </h3>
            {weakAreas.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">
                No weak areas flagged yet. Complete quizzes or rate flashcards to identify topics needing reinforcement.
              </p>
            ) : (
              <div className="space-y-2">
                {weakAreas.map((w, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveTab(w.targetTab)}
                    className="w-full text-left p-2.5 rounded-xl bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/20 text-xs transition-colors"
                  >
                    <div className="font-bold text-slate-800 dark:text-slate-200 truncate">{w.label}</div>
                    <div className="text-[11px] text-rose-500 mt-0.5">{w.reason}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Persisted Learning Tasks & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-emerald-500" /> Today's Study Tasks
            </h3>

            <form onSubmit={handleCreateTask} className="flex gap-2">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Add a study task..."
                className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs w-56"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </form>
          </div>

          {tasks.length === 0 ? (
            <p className="text-xs text-slate-400 py-3">No study tasks yet. Add your first goal above.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`p-3.5 rounded-xl border text-xs transition-all flex items-center justify-between gap-2 ${
                    task.completed
                      ? 'bg-emerald-500/5 border-emerald-500/20 text-slate-400'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <button
                    onClick={() => onToggleTask?.(task.id)}
                    className="flex items-center gap-3 flex-1 text-left min-w-0"
                  >
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                        task.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-400'
                      }`}
                    >
                      {task.completed && <CheckCircle2 className="w-3 h-3" />}
                    </div>
                    <span className={`line-clamp-2 ${task.completed ? 'line-through' : ''}`}>
                      {task.title}
                    </span>
                  </button>
                  {onDeleteTask && (
                    <button
                      onClick={() => onDeleteTask(task.id)}
                      className="p-1 text-slate-400 hover:text-rose-500 shrink-0"
                      title="Delete task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <History className="w-4 h-4 text-purple-500" /> Recent Activity
            </h3>
            <button
              onClick={() => setActiveTab('history')}
              className="text-[11px] text-indigo-500 font-semibold hover:underline"
            >
              View All
            </button>
          </div>

          {historyLogs.length === 0 ? (
            <p className="text-xs text-slate-400 py-3">No recent activity logged yet.</p>
          ) : (
            <div className="space-y-2">
              {historyLogs.slice(0, 5).map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-xs"
                >
                  <div className="font-bold text-slate-800 dark:text-slate-200 truncate">{log.title}</div>
                  <div className="text-[10px] text-slate-500 truncate">{log.details}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Suggested AI Prompts */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-sm text-white">Suggested AI Study Prompts</h3>
          </div>
          <span className="text-xs text-slate-400">Click to run in Tutor Chat</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {quickPrompts.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => onQuickPromptChat(prompt)}
              className="text-left bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-indigo-500/50 p-3.5 rounded-xl transition-all group"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-slate-200 group-hover:text-white font-medium leading-relaxed">
                  "{prompt}"
                </p>
                <ArrowRight className="w-3.5 h-3.5 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
