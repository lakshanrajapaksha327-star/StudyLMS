import React, { useState } from 'react';
import {
  FileText,
  MessageSquareText,
  Notebook as NotebookIcon,
  Layers,
  HelpCircle,
  Sparkles,
  Flame,
  CheckCircle2,
  Clock,
  ArrowRight,
  Zap,
  BookOpen,
  GraduationCap,
  Calendar,
  Target,
  CheckSquare,
  Trophy,
  Award,
  AlertTriangle
} from 'lucide-react';
import { ActiveTab, Notebook, SourceDocument, NoteItem, FlashcardSet, QuizSet, StudyStats } from '../types';

interface DashboardViewProps {
  setActiveTab: (tab: ActiveTab) => void;
  activeNotebook: Notebook | undefined;
  sources: SourceDocument[];
  notes: NoteItem[];
  flashcardSets: FlashcardSet[];
  quizSets: QuizSet[];
  stats: StudyStats;
  onQuickPromptChat: (prompt: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  setActiveTab,
  activeNotebook,
  sources,
  notes,
  flashcardSets,
  quizSets,
  stats,
  onQuickPromptChat,
}) => {
  // Goal Tracker State
  const [dailyGoalMinutes] = useState(60);
  const [studiedMinutes] = useState(42);

  // Today's Study Tasks
  const [tasks, setTasks] = useState([
    { id: 't1', text: 'Review 15 Calculus Flashcards (SM-2 Box 1)', done: true },
    { id: 't2', text: 'Complete Organic Chemistry Practice Test', done: false },
    { id: 't3', text: 'Summarize Chapter 4 Physics Lecture Notes', done: false },
  ]);

  // Upcoming Exams
  const [upcomingExams] = useState([
    { id: 'e1', title: 'Calculus II Midterm', date: '2026-08-05', daysLeft: 14, color: 'text-amber-500' },
    { id: 'e2', title: 'Biochemistry Final', date: '2026-08-12', daysLeft: 21, color: 'text-pink-500' },
  ]);

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  const quickPrompts = [
    'Generate an executive summary of my uploaded documents.',
    'Create 5 high-yield exam questions based on my current notebook sources.',
    'Explain the single hardest concept in simple terms with analogies.',
    'Extract all key mathematical formulas or technical definitions into a cheat sheet.',
  ];

  // Generate GitHub-style 28-day study heatmap grid
  const renderHeatmap = () => {
    const days = Array.from({ length: 28 }, (_, i) => {
      const level = (i * 7 + 3) % 5;
      return { day: i + 1, level };
    });

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
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5 font-bold">
            <Calendar className="w-3.5 h-3.5 text-emerald-500" /> Study Heatmap (GitHub-Style Past 4 Weeks)
          </span>
          <span className="text-[10px]">Less ▫ ▪ ▪ ▪ ▪ More</span>
        </div>
        <div className="grid grid-cols-7 gap-1.5 p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800">
          {days.map((d) => (
            <div
              key={d.day}
              className={`h-7 rounded-md transition-all ${getLevelBg(d.level)} flex items-center justify-center text-[9px] text-slate-400`}
              title={`Day ${d.day}: ${d.level * 20} mins studied`}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Welcome Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 text-white border border-slate-800 shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold mb-4">
            <Flame className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> {stats.studyStreakDays} Day Active Study Streak!
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
            Welcome back to <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-indigo-300 to-pink-300">{activeNotebook?.title || 'Study Assistant'}</span>
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed mb-6">
            Synthesize documents with <strong className="text-white">NotebookLM</strong> grounding, converse with your <strong className="text-white">ChatGPT</strong> study tutor, format smart notes with <strong className="text-white">Notion AI</strong>, and master concepts with <strong className="text-white">Quizlet</strong> flashcards.
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

      {/* AI Advisory Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl font-bold shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300">
              AI Advisory: You're weak in Calculus Limits
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              Targeted suggestion: Review 10 flashcards on limits today before taking your practice exam.
            </p>
          </div>
        </div>

        <button
          onClick={() => setActiveTab('flashcards')}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow shrink-0"
        >
          Study Calculus Today
        </button>
      </div>

      {/* Goal Tracker & Stat Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Daily Target</span>
            <Target className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {studiedMinutes} / {dailyGoalMinutes} <span className="text-xs font-normal text-slate-400">mins</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
            <div
              className="bg-emerald-500 h-full transition-all"
              style={{ width: `${Math.round((studiedMinutes / dailyGoalMinutes) * 100)}%` }}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Cards Mastered</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100">{stats.cardsMastered} Cards</div>
          <p className="text-[11px] text-emerald-500 font-semibold mt-1">SM-2 Algorithm Active</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Sources</span>
            <FileText className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100">{sources.length} Docs</div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Synced & Grounded</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Quizzes Passed</span>
            <GraduationCap className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100">{stats.quizzesCompleted} Tests</div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Leaderboard Ranked</p>
        </div>
      </div>

      {/* Heatmap + Tasks & Exams Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-xs">
          {renderHeatmap()}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-500" /> Upcoming Exams
          </h3>
          <div className="space-y-2">
            {upcomingExams.map((ex) => (
              <div key={ex.id} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-200">{ex.title}</h4>
                  <span className="text-[10px] text-slate-400">{ex.date}</span>
                </div>
                <span className={`font-extrabold ${ex.color}`}>{ex.daysLeft}d left</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Today's Tasks */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-emerald-500" /> Today's Learning Agenda
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {tasks.map((task) => (
            <div
              key={task.id}
              onClick={() => toggleTask(task.id)}
              className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center gap-3 ${
                task.done
                  ? 'bg-emerald-500/5 border-emerald-500/20 text-slate-400 line-through'
                  : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-slate-400'
              }`}
            >
              <div
                className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                  task.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-400'
                }`}
              >
                {task.done && <CheckCircle2 className="w-3 h-3" />}
              </div>
              <span className="line-clamp-2">{task.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Suggested AI Prompts */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-sm text-white">Suggested AI Study Prompts</h3>
          </div>
          <span className="text-xs text-slate-400">Click to run with Gemini</span>
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

