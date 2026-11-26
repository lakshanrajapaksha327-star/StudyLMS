import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  BookOpen,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Plus,
  X,
  Target,
  Zap,
  TrendingUp,
  Brain,
  LayoutGrid,
  ListChecks,
} from 'lucide-react';
import {
  generateStudyPlan,
  recalibrateStudyPlan,
  toggleStudyTopic,
  fetchLatestStudyPlan,
} from '../services/api';

export function StudyPlannerView() {
  const [subjects, setSubjects] = useState<string[]>([
    'Computer Science',
    'Linear Algebra',
    'Physics',
  ]);
  const [subjectInput, setSubjectInput] = useState('');
  const [examDate, setExamDate] = useState(() => {
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 14);
    return defaultDate.toISOString().split('T')[0];
  });
  const [hoursPerDay, setHoursPerDay] = useState(4);
  const [focusAreas, setFocusAreas] = useState('Graph Algorithms, Matrix Inverses, Thermodynamics');
  const [weakTopicsInput, setWeakTopicsInput] = useState('Eigenvalues, Dynamic Programming');
  const [strongTopicsInput, setStrongTopicsInput] = useState('Basic Syntax, Kinematics');
  const [preferredStudyTime, setPreferredStudyTime] = useState<'Morning' | 'Afternoon' | 'Evening' | 'Flexible'>('Morning');

  const [plan, setPlan] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecalibrating, setIsRecalibrating] = useState(false);
  const [showRecalibrateModal, setShowRecalibrateModal] = useState(false);
  const [missedTopicInput, setMissedTopicInput] = useState('');
  const [selectedDayTab, setSelectedDayTab] = useState<number>(1);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadExistingPlan();
  }, []);

  const loadExistingPlan = async () => {
    try {
      const latest = await fetchLatestStudyPlan();
      if (latest) {
        setPlan(latest);
      }
    } catch {
      // Unauthenticated or no existing plan yet
    }
  };

  const handleAddSubject = () => {
    if (subjectInput.trim() && !subjects.includes(subjectInput.trim())) {
      setSubjects([...subjects, subjectInput.trim()]);
      setSubjectInput('');
    }
  };

  const handleRemoveSubject = (sub: string) => {
    setSubjects(subjects.filter((s) => s !== sub));
  };

  const handleGeneratePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subjects.length === 0) {
      setErrorMsg('Please add at least one study subject.');
      return;
    }
    setErrorMsg('');
    setIsLoading(true);

    try {
      const weakTopics = weakTopicsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const strongTopics = strongTopicsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const newPlan = await generateStudyPlan({
        subjects,
        examDate,
        hoursPerDay,
        focusAreas,
        weakTopics,
        strongTopics,
        preferredStudyTime,
      });
      setPlan(newPlan);
      setSelectedDayTab(1);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate study plan.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleTopic = async (topicId: string) => {
    if (!plan) return;
    try {
      const updated = await toggleStudyTopic(plan.id, topicId);
      setPlan(updated);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to update study topic status.');
    }
  };

  const incompleteEarlyTopics = useMemo(() => {
    if (!plan?.schedule) return [];
    const list: string[] = [];
    for (const day of plan.schedule) {
      if (day.dayNumber <= 2 && Array.isArray(day.topics)) {
        for (const t of day.topics) {
          if (!t.completed && t.topicName) list.push(t.topicName);
        }
      }
    }
    return list;
  }, [plan]);

  const openRecalibration = () => {
    if (!missedTopicInput && incompleteEarlyTopics.length > 0) {
      setMissedTopicInput(incompleteEarlyTopics.slice(0, 4).join(', '));
    }
    setShowRecalibrateModal(true);
  };

  const handleRecalibrate = async () => {
    if (!plan) return;
    setIsRecalibrating(true);
    setErrorMsg('');

    try {
      const missedList = missedTopicInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const updated = await recalibrateStudyPlan({
        planId: plan.id,
        missedTopics: missedList.length > 0 ? missedList : ['Overdue topics'],
        daysRemaining: calculateDaysRemaining(plan.examDate),
      });

      setPlan(updated);
      setShowRecalibrateModal(false);
      setMissedTopicInput('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to recalibrate plan.');
    } finally {
      setIsRecalibrating(false);
    }
  };

  const calculateDaysRemaining = (target: string) => {
    if (!target) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(target);
    targetDate.setHours(0, 0, 0, 0);
    const diff = targetDate.getTime() - today.getTime();
    return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 p-4 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 font-semibold text-sm mb-1">
            <Sparkles className="w-4 h-4" />
            <span>AI Learning Roadmap & Schedule Engine</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            AI Personalized Study Planner
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 max-w-2xl">
            Configure subjects, weak topics, preferred study hours, and exam dates to build an adaptive day-by-day schedule.
          </p>
        </div>

        {plan && (
          <div className="flex items-center space-x-3 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Exam Date</div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                {plan.examDate} ({calculateDaysRemaining(plan.examDate)} days left)
              </div>
            </div>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl text-sm flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center space-x-2">
              <Target className="w-5 h-5 text-indigo-500" />
              <span>Configure Study Goal</span>
            </h2>

            <form onSubmit={handleGeneratePlan} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Subjects & Courses
                </label>
                <div className="flex space-x-2 mb-2">
                  <input
                    type="text"
                    value={subjectInput}
                    onChange={(e) => setSubjectInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSubject())}
                    placeholder="e.g. Organic Chemistry"
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddSubject}
                    className="px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-slate-700 dark:text-slate-200 text-sm font-medium transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {subjects.map((sub) => (
                    <span
                      key={sub}
                      className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-medium rounded-md border border-indigo-200 dark:border-indigo-800"
                    >
                      <span>{sub}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSubject(sub)}
                        className="text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-200"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Target Exam Date
                  </label>
                  <input
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Preferred Time
                  </label>
                  <select
                    value={preferredStudyTime}
                    onChange={(e) => setPreferredStudyTime(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Morning">Morning</option>
                    <option value="Afternoon">Afternoon</option>
                    <option value="Evening">Evening</option>
                    <option value="Flexible">Flexible</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Daily Study Target
                  </label>
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                    {hoursPerDay} hrs / day
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={hoursPerDay}
                  onChange={(e) => setHoursPerDay(parseFloat(e.target.value))}
                  className="w-full accent-indigo-600 dark:accent-indigo-400 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Weak Topics (Comma-separated)
                </label>
                <input
                  type="text"
                  value={weakTopicsInput}
                  onChange={(e) => setWeakTopicsInput(e.target.value)}
                  placeholder="e.g. Eigenvalues, Dynamic Programming"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Strong Topics (Comma-separated)
                </label>
                <input
                  type="text"
                  value={strongTopicsInput}
                  onChange={(e) => setStrongTopicsInput(e.target.value)}
                  placeholder="e.g. Basic Syntax, Kinematics"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Priority Focus Notes
                </label>
                <textarea
                  rows={2}
                  value={focusAreas}
                  onChange={(e) => setFocusAreas(e.target.value)}
                  placeholder="e.g. Need extra practice on Graph Search Algorithms"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-sm transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>AI Planning...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate AI Study Plan</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {plan && plan.adaptiveTips && (
            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl p-6 space-y-4 shadow-md">
              <div className="flex items-center space-x-2 text-indigo-300 font-semibold text-xs tracking-wider uppercase">
                <Brain className="w-4 h-4" />
                <span>AI Cognitive Strategy Tips</span>
              </div>
              <ul className="space-y-3">
                {plan.adaptiveTips.map((tip: string, idx: number) => (
                  <li key={idx} className="flex items-start space-x-2.5 text-xs text-slate-200 leading-relaxed">
                    <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="lg:col-span-8 space-y-6">
          {!plan ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                <BookOpen className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  No Active Study Plan Yet
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  Add your subjects, weak topics, and exam date on the left to generate a personalized study schedule.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {incompleteEarlyTopics.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>
                      <strong>{incompleteEarlyTopics.length} early-phase topics</strong> remain incomplete ({incompleteEarlyTopics.slice(0, 2).join(', ')}). Need to rebalance?
                    </span>
                  </div>
                  <button
                    onClick={openRecalibration}
                    className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold shrink-0"
                  >
                    Auto-Recalibrate
                  </button>
                </div>
              )}

              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-semibold tracking-wider text-indigo-600 dark:text-indigo-400 uppercase">
                      Active AI Plan
                    </span>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                      {plan.title}
                    </h2>
                  </div>

                  <button
                    onClick={openRecalibration}
                    className="inline-flex items-center space-x-2 px-3.5 py-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 text-xs font-semibold rounded-xl transition-colors shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Recalibrate / Fell Behind?</span>
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-300">
                    <span>Overall Mastery Progress</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      {plan.overallProgress || 0}% Complete
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 dark:bg-indigo-500 h-full transition-all duration-500 rounded-full"
                      style={{ width: `${plan.overallProgress || 0}%` }}
                    />
                  </div>
                </div>

                {plan.prioritizedTopics && plan.prioritizedTopics.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 flex items-center space-x-1">
                      <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                      <span>High-Yield Priority Focus Areas:</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {plan.prioritizedTopics.map((topic: string, i: number) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-xs font-medium rounded-md border border-amber-200 dark:border-amber-800/50"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                  <h3 className="font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-indigo-500" />
                    <span>{viewMode === 'daily' ? 'Day-by-Day Roadmap' : 'Weekly Schedule Overview'}</span>
                  </h3>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-slate-100 dark:bg-slate-700 p-0.5 rounded-lg text-xs">
                      <button
                        type="button"
                        onClick={() => setViewMode('daily')}
                        className={`px-2.5 py-1 rounded-md flex items-center gap-1 font-semibold ${
                          viewMode === 'daily'
                            ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                            : 'text-slate-500'
                        }`}
                      >
                        <ListChecks className="w-3.5 h-3.5" /> Daily
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('weekly')}
                        className={`px-2.5 py-1 rounded-md flex items-center gap-1 font-semibold ${
                          viewMode === 'weekly'
                            ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                            : 'text-slate-500'
                        }`}
                      >
                        <LayoutGrid className="w-3.5 h-3.5" /> Weekly
                      </button>
                    </div>
                    <span className="text-xs text-slate-400">{plan.schedule?.length || 0} Days</span>
                  </div>
                </div>

                {viewMode === 'weekly' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {plan.schedule?.map((day: any) => {
                      const doneCount = (day.topics || []).filter((t: any) => t.completed).length;
                      const totalDay = (day.topics || []).length;
                      return (
                        <div
                          key={day.dayNumber}
                          onClick={() => {
                            setSelectedDayTab(day.dayNumber);
                            setViewMode('daily');
                          }}
                          className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 hover:border-indigo-500 cursor-pointer space-y-2 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                              Day {day.dayNumber} • {day.focusSubject}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {doneCount}/{totalDay} done • {day.totalHours}h
                            </span>
                          </div>
                          <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                            {day.topics?.slice(0, 3).map((t: any) => (
                              <li key={t.id} className={t.completed ? 'line-through opacity-60' : ''}>
                                • {t.topicName} ({t.estimatedHours}h)
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-none">
                      {plan.schedule?.map((day: any) => {
                        const isSelected = selectedDayTab === day.dayNumber;
                        return (
                          <button
                            key={day.dayNumber}
                            onClick={() => setSelectedDayTab(day.dayNumber)}
                            className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex flex-col items-center space-y-0.5 ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : day.completed
                                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                            }`}
                          >
                            <span>Day {day.dayNumber}</span>
                            <span className="text-[10px] opacity-80">{day.focusSubject}</span>
                          </button>
                        );
                      })}
                    </div>

                    {(() => {
                      const currentDay =
                        plan.schedule?.find((d: any) => d.dayNumber === selectedDayTab) ||
                        plan.schedule?.[0];
                      if (!currentDay) return null;

                      return (
                        <div className="space-y-4 pt-2">
                          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                            <div>
                              <div className="text-sm font-bold text-slate-900 dark:text-white">
                                Day {currentDay.dayNumber} Focus: {currentDay.focusSubject}
                              </div>
                              {currentDay.notes && (
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                  {currentDay.notes}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                              <Clock className="w-3.5 h-3.5 text-indigo-500" />
                              <span>{currentDay.totalHours} hrs scheduled</span>
                            </div>
                          </div>

                          <div className="space-y-2.5">
                            {currentDay.topics?.map((topic: any) => (
                              <div
                                key={topic.id}
                                onClick={() => handleToggleTopic(topic.id)}
                                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between space-x-4 ${
                                  topic.completed
                                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 line-through opacity-80'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 shadow-xs'
                                }`}
                              >
                                <div className="flex items-center space-x-3 min-w-0">
                                  <input
                                    type="checkbox"
                                    checked={topic.completed}
                                    onChange={() => {}}
                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                                  />
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                      {topic.topicName}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                      {topic.subject} • ~{topic.estimatedHours} hour(s)
                                    </div>
                                  </div>
                                </div>

                                <span
                                  className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-md uppercase tracking-wider shrink-0 ${
                                    topic.priority === 'High'
                                      ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
                                      : topic.priority === 'Low'
                                      ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
                                      : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800'
                                  }`}
                                >
                                  {topic.priority} Priority
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showRecalibrateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 border border-slate-200 dark:border-slate-700 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <RefreshCw className="w-4 h-4 text-amber-500" />
                <span>AI Plan Recalibration</span>
              </h3>
              <button
                onClick={() => setShowRecalibrateModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Missed sessions or falling behind? Confirm the topics that need re-allocation and AI will rebuild your remaining schedule.
            </p>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Missed / Incomplete Topics
              </label>
              <textarea
                rows={3}
                value={missedTopicInput}
                onChange={(e) => setMissedTopicInput(e.target.value)}
                placeholder="e.g. Chapter 4 Integration, Graph Theory Dijkstra algorithm"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRecalibrateModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRecalibrate}
                disabled={isRecalibrating}
                className="px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-sm transition-colors flex items-center space-x-1.5 disabled:opacity-50"
              >
                {isRecalibrating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Recalibrating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Recalibrate Schedule</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
