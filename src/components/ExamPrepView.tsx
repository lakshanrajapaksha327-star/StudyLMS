import React, { useCallback, useEffect, useState } from 'react';
import {
  GraduationCap,
  Sparkles,
  Calendar,
  BookOpen,
  CheckSquare,
  Square,
  FileText,
  Download,
  Clock,
  AlertTriangle,
  Trash2,
  Play,
  RotateCcw,
} from 'lucide-react';
import {
  deleteExamPrepGuideApi,
  fetchExamPrepGuidesApi,
  generateExamPrepGuideApi,
  updateExamPrepChecklistApi,
} from '../services/api';
import { ExamPrepGuide, SourceDocument } from '../types';
import {
  exportToDocx,
  exportToJson,
  exportToMarkdown,
  exportToPrintablePdf,
} from '../utils/exportImport';

interface ExamPrepViewProps {
  sources: SourceDocument[];
  activeNotebookId?: string;
}

export const ExamPrepView: React.FC<ExamPrepViewProps> = ({ sources, activeNotebookId }) => {
  const [guides, setGuides] = useState<ExamPrepGuide[]>([]);
  const [activeGuideId, setActiveGuideId] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  // Generator form
  const [subject, setSubject] = useState('');
  const [examDate, setExamDate] = useState(
    new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)
  );
  const [syllabusText, setSyllabusText] = useState('');
  const [pastPaperNotes, setPastPaperNotes] = useState('');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  // View sub-tab & Timed Mock Exam state
  const [subTab, setSubTab] = useState<
    'plan' | 'topics' | 'practice' | 'formulas' | 'checklist' | 'mock'
  >('plan');
  const [mockStarted, setMockStarted] = useState(false);
  const [mockSubmitted, setMockSubmitted] = useState(false);
  const [mockAnswers, setMockAnswers] = useState<Record<number, string>>({});
  const [mockSecondsLeft, setMockSecondsLeft] = useState(15 * 60);

  const loadGuides = useCallback(async () => {
    setLoadingList(true);
    setError('');
    try {
      const list = await fetchExamPrepGuidesApi(activeNotebookId);
      setGuides(list);
      if (list.length > 0) {
        setActiveGuideId((prev) => (prev && list.some((g) => g.id === prev) ? prev : list[0].id));
      } else {
        setActiveGuideId(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load exam preparation guides.');
    } finally {
      setLoadingList(false);
    }
  }, [activeNotebookId]);

  useEffect(() => {
    loadGuides();
  }, [loadGuides]);

  useEffect(() => {
    if (!mockStarted || mockSubmitted) return;
    if (mockSecondsLeft <= 0) {
      setMockSubmitted(true);
      setMockStarted(false);
      return;
    }
    const id = setInterval(() => setMockSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [mockStarted, mockSubmitted, mockSecondsLeft]);

  const activeGuide = guides.find((g) => g.id === activeGuideId) || guides[0] || null;

  const handleToggleDoc = (id: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !examDate) return;
    setGenerating(true);
    setError('');
    try {
      const guide = await generateExamPrepGuideApi({
        notebookId: activeNotebookId,
        subject: subject.trim(),
        examDate,
        syllabusText: syllabusText.trim() || undefined,
        pastPaperNotes: pastPaperNotes.trim() || undefined,
        selectedDocumentIds: selectedDocIds.length > 0 ? selectedDocIds : undefined,
      });
      setGuides((prev) => [guide, ...prev]);
      setActiveGuideId(guide.id);
      setSubject('');
      setSyllabusText('');
      setPastPaperNotes('');
      setSubTab('plan');
    } catch (err: any) {
      setError(err?.message || 'Failed to generate exam preparation guide.');
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleChecklistItem = async (itemId: string) => {
    if (!activeGuide) return;
    const nextChecklist = activeGuide.revisionChecklist.map((c) =>
      c.id === itemId ? { ...c, completed: !c.completed } : c
    );
    setGuides((prev) =>
      prev.map((g) => (g.id === activeGuide.id ? { ...g, revisionChecklist: nextChecklist } : g))
    );
    try {
      await updateExamPrepChecklistApi(activeGuide.id, nextChecklist);
    } catch (err: any) {
      setError(err?.message || 'Could not update checklist item.');
    }
  };

  const handleDeleteGuide = async (id: string) => {
    try {
      await deleteExamPrepGuideApi(id);
      const remaining = guides.filter((g) => g.id !== id);
      setGuides(remaining);
      setActiveGuideId(remaining[0]?.id || null);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete exam prep guide.');
    }
  };

  const buildGuideExportSections = (guide: ExamPrepGuide) => [
    {
      heading: 'Exam Overview & Uncertainty Notice',
      body: `Subject: ${guide.subject}\nExam Date: ${guide.examDate}\nEvidence Sources: ${
        guide.evidenceSources?.length ? guide.evidenceSources.join(', ') : 'Syllabus & Past Paper Notes only'
      }\n\nNote: ${guide.uncertaintyNotice}\n\n${guide.syllabusSummary || ''}`,
    },
    {
      heading: 'Topic Revision Plan',
      body: guide.topicPlan
        .map(
          (t, i) =>
            `${i + 1}. [${t.priority.toUpperCase()}] ${t.topic} (~${t.estimatedHours}h)\n   Rationale: ${t.rationale}`
        )
        .join('\n\n'),
    },
    {
      heading: 'Prioritized & Likely Exam Topics',
      body: guide.likelyTopics
        .map(
          (lt) =>
            `- ${lt.topic} (${lt.likelihood} priority${lt.isEstimate ? ' — Estimate' : ' — Evidence-backed'})\n  Basis: ${lt.evidenceBasis}`
        )
        .join('\n'),
    },
    {
      heading: 'Practice Questions & Model Answers',
      body: guide.practiceQuestions
        .map(
          (pq, i) =>
            `Q${i + 1}${pq.marks ? ` (${pq.marks} marks)` : ''}: ${pq.question}\nModel Answer: ${pq.modelAnswer}`
        )
        .join('\n\n'),
    },
    {
      heading: 'Formula & Key Definition Sheet',
      body: guide.formulaSheet
        .map((f) => `${f.name}: ${f.formula}\nUsage: ${f.usageNote}`)
        .join('\n\n'),
    },
    {
      heading: 'Revision Checklist',
      body: guide.revisionChecklist
        .map((c) => `[${c.completed ? 'x' : ' '}] ${c.item}`)
        .join('\n'),
    },
  ];

  const startMockExam = () => {
    setMockAnswers({});
    setMockSubmitted(false);
    setMockSecondsLeft(Math.max(5, (activeGuide?.mockExamQuestions.length || 5) * 3) * 60);
    setMockStarted(true);
  };

  const mockCorrectCount =
    activeGuide?.mockExamQuestions.filter(
      (q, i) =>
        (mockAnswers[i] || '').trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()
    ).length || 0;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-indigo-500" /> Smart Exam Preparation Workspace
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Combine your syllabus, uploaded documents, and past-paper patterns into structured revision plans, formula sheets, and timed mock exams.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs rounded-xl">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Builder Form + Saved Guides */}
        <div className="space-y-6">
          <form
            onSubmit={handleGenerate}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4"
          >
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" /> Build Exam Prep Workspace
            </h2>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Subject / Course Name
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Linear Algebra & Eigenvalues"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Target Exam Date
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="date"
                  required
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {sources.length > 0 && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                  Reference Documents ({selectedDocIds.length || 'All notebook docs'})
                </label>
                <div className="max-h-28 overflow-y-auto space-y-1 border border-slate-200 dark:border-slate-800 rounded-xl p-2 bg-slate-50/50 dark:bg-slate-800/30">
                  {sources.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedDocIds.includes(s.id)}
                        onChange={() => handleToggleDoc(s.id)}
                        className="accent-indigo-600"
                      />
                      <span className="truncate text-slate-700 dark:text-slate-300">{s.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Syllabus / Learning Objectives (Optional)
              </label>
              <textarea
                rows={3}
                value={syllabusText}
                onChange={(e) => setSyllabusText(e.target.value)}
                placeholder="Paste syllabus modules or exam scope..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Past Paper Themes / Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={pastPaperNotes}
                onChange={(e) => setPastPaperNotes(e.target.value)}
                placeholder="Paste recurring past paper topics or question styles..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <button
              type="submit"
              disabled={generating}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center gap-2"
            >
              <Sparkles className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
              <span>{generating ? 'Synthesizing Exam Workspace...' : 'Generate Exam Prep Pack'}</span>
            </button>
          </form>

          {/* Saved Guides */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Saved Exam Workspaces ({guides.length})
            </h3>
            {loadingList ? (
              <div className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
            ) : guides.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                No exam workspaces created yet.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {guides.map((g) => (
                  <div
                    key={g.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                      g.id === activeGuide?.id
                        ? 'bg-indigo-500/10 border-indigo-500/40'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveGuideId(g.id)}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {g.subject}
                      </div>
                      <div className="text-[10px] text-slate-400">Exam: {g.examDate}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteGuide(g.id)}
                      aria-label={`Delete exam guide ${g.subject}`}
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

        {/* Right 2 Columns: Active Guide Workspace */}
        <div className="lg:col-span-2">
          {activeGuide ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    {activeGuide.subject}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Exam Date: {activeGuide.examDate} •{' '}
                    {activeGuide.evidenceSources?.length
                      ? `Evidence: ${activeGuide.evidenceSources.join(', ')}`
                      : 'Based on user inputs'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      exportToPrintablePdf(
                        `${activeGuide.subject} - Exam Prep`,
                        buildGuideExportSections(activeGuide)
                      )
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-semibold flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" /> PDF
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      exportToDocx(
                        `${activeGuide.subject}_exam_prep`,
                        `${activeGuide.subject} Exam Prep`,
                        buildGuideExportSections(activeGuide)
                      )
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-semibold flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" /> DOCX
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      exportToMarkdown(
                        `${activeGuide.subject}_exam_prep`,
                        `${activeGuide.subject} Exam Prep`,
                        buildGuideExportSections(activeGuide)
                      )
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-semibold"
                  >
                    .MD
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      exportToJson(`${activeGuide.subject}_exam_prep`, activeGuide)
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-semibold"
                  >
                    .JSON
                  </button>
                </div>
              </div>

              {/* Honest Uncertainty Notice */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{activeGuide.uncertaintyNotice}</span>
              </div>

              {/* Workspace Tabs */}
              <div className="flex flex-wrap gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-3">
                {(
                  [
                    { id: 'plan', label: 'Revision Plan' },
                    { id: 'topics', label: 'Themes & Likely Topics' },
                    { id: 'practice', label: `Practice Q&A (${activeGuide.practiceQuestions.length})` },
                    { id: 'formulas', label: `Formulas (${activeGuide.formulaSheet.length})` },
                    { id: 'checklist', label: 'Checklist' },
                    { id: 'mock', label: 'Timed Mock Exam' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSubTab(t.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                      subTab === t.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {subTab === 'plan' && (
                <div className="space-y-4">
                  {activeGuide.syllabusSummary && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl">
                      {activeGuide.syllabusSummary}
                    </p>
                  )}
                  <div className="space-y-2.5">
                    {activeGuide.topicPlan.map((tp, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 flex items-start justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {idx + 1}. {tp.topic}
                            </span>
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                tp.priority === 'high'
                                  ? 'bg-rose-500/15 text-rose-500'
                                  : tp.priority === 'medium'
                                  ? 'bg-amber-500/15 text-amber-500'
                                  : 'bg-emerald-500/15 text-emerald-500'
                              }`}
                            >
                              {tp.priority}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{tp.rationale}</p>
                        </div>
                        <span className="text-xs font-bold text-indigo-500 shrink-0">
                          {tp.estimatedHours}h
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {subTab === 'topics' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Important Concepts & Recurring Themes
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {[...activeGuide.importantConcepts, ...activeGuide.recurringThemes].map(
                        (concept, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-xs font-semibold"
                          >
                            {concept}
                          </span>
                        )
                      )}
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Likely Exam Focus Areas
                    </h3>
                    {activeGuide.likelyTopics.map((lt, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {lt.topic}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                            {lt.isEstimate ? 'Estimate (Uncertain)' : 'Evidence-Based'} •{' '}
                            {lt.likelihood.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {lt.evidenceBasis}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {subTab === 'practice' && (
                <div className="space-y-3">
                  {activeGuide.practiceQuestions.map((pq, idx) => (
                    <details
                      key={idx}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30"
                    >
                      <summary className="cursor-pointer text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between gap-2">
                        <span>
                          Q{idx + 1}: {pq.question}
                        </span>
                        {pq.marks && (
                          <span className="text-[10px] text-indigo-500 shrink-0">
                            {pq.marks} marks
                          </span>
                        )}
                      </summary>
                      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                        <strong className="text-emerald-500 block mb-1">Model Answer:</strong>
                        {pq.modelAnswer}
                      </div>
                    </details>
                  ))}
                </div>
              )}

              {subTab === 'formulas' && (
                <div className="space-y-2.5">
                  {activeGuide.formulaSheet.length === 0 ? (
                    <p className="text-xs text-slate-400 py-8 text-center">
                      No domain formulas extracted for this subject.
                    </p>
                  ) : (
                    activeGuide.formulaSheet.map((f, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-1.5"
                      >
                        <div className="text-xs font-bold text-indigo-500">{f.name}</div>
                        <pre className="font-mono text-xs bg-slate-900 text-emerald-300 p-2.5 rounded-lg overflow-x-auto">
                          {f.formula}
                        </pre>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {f.usageNote}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {subTab === 'checklist' && (
                <div className="space-y-2">
                  {activeGuide.revisionChecklist.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleToggleChecklistItem(c.id)}
                      className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center gap-3 text-xs"
                    >
                      {c.completed ? (
                        <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span
                        className={
                          c.completed
                            ? 'line-through text-slate-400'
                            : 'text-slate-800 dark:text-slate-200 font-medium'
                        }
                      >
                        {c.item}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {subTab === 'mock' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800/60 p-3.5 rounded-xl">
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <Clock className="w-4 h-4 text-pink-500" />
                      <span>
                        {Math.floor(mockSecondsLeft / 60)}:
                        {String(mockSecondsLeft % 60).padStart(2, '0')} remaining
                      </span>
                    </div>
                    {!mockStarted ? (
                      <button
                        type="button"
                        onClick={startMockExam}
                        className="px-4 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold flex items-center gap-1.5"
                      >
                        {mockSubmitted ? <RotateCcw className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        <span>{mockSubmitted ? 'Restart Mock Exam' : 'Start Timed Mock Exam'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setMockSubmitted(true);
                          setMockStarted(false);
                        }}
                        className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                      >
                        Submit Mock Exam
                      </button>
                    )}
                  </div>

                  {mockSubmitted && (
                    <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-xs font-bold text-indigo-400">
                      Mock Exam Result: {mockCorrectCount} / {activeGuide.mockExamQuestions.length}{' '}
                      correct (
                      {Math.round(
                        (mockCorrectCount / Math.max(1, activeGuide.mockExamQuestions.length)) * 100
                      )}
                      %)
                    </div>
                  )}

                  <div className="space-y-4">
                    {activeGuide.mockExamQuestions.map((mq, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs"
                      >
                        <div className="font-bold text-slate-900 dark:text-white">
                          {idx + 1}. {mq.question}
                        </div>
                        {mq.options && mq.options.length > 0 ? (
                          <div className="grid grid-cols-1 gap-1.5">
                            {mq.options.map((opt, oIdx) => {
                              const picked = mockAnswers[idx] === opt;
                              const isRight = opt === mq.correctAnswer;
                              let cls =
                                'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700';
                              if (mockSubmitted && isRight) {
                                cls = 'bg-emerald-500/15 border-emerald-500 text-emerald-400 font-bold';
                              } else if (mockSubmitted && picked && !isRight) {
                                cls = 'bg-rose-500/15 border-rose-500 text-rose-400';
                              } else if (picked) {
                                cls = 'bg-indigo-500/15 border-indigo-500 text-indigo-400 font-semibold';
                              }
                              return (
                                <button
                                  key={oIdx}
                                  type="button"
                                  disabled={!mockStarted}
                                  onClick={() => setMockAnswers((prev) => ({ ...prev, [idx]: opt }))}
                                  className={`p-2.5 rounded-lg border text-left transition-colors ${cls}`}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <input
                            type="text"
                            disabled={!mockStarted}
                            value={mockAnswers[idx] || ''}
                            onChange={(e) =>
                              setMockAnswers((prev) => ({ ...prev, [idx]: e.target.value }))
                            }
                            placeholder="Type your answer..."
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2"
                          />
                        )}

                        {mockSubmitted && (
                          <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/70 text-[11px] text-slate-600 dark:text-slate-300">
                            <strong>Answer:</strong> {mq.correctAnswer} — {mq.explanation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                Create your first Exam Preparation Workspace
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Enter your subject and exam date on the left, select uploaded lecture notes or past papers, and generate a structured revision plan with a timed mock exam.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
