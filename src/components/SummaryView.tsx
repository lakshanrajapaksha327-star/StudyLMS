import React, { useState, useEffect } from 'react';
import {
  FileText,
  Sparkles,
  BookOpen,
  Tag,
  Volume2,
  Copy,
  Check,
  Download,
  Lightbulb,
  Square,
  Save,
  Quote,
} from 'lucide-react';
import { DocumentCitation, NoteItem, SourceDocument } from '../types';
import { generateSpeechAudio, generateSummaryModeApi } from '../services/api';

interface SummaryViewProps {
  sources: SourceDocument[];
  activeNotebookId?: string;
  onSaveNote?: (note: NoteItem, saveVersion?: boolean) => void | Promise<void>;
  onOpenCitation?: (citation: DocumentCitation) => void;
}

const SUMMARY_MODES = [
  { id: 'short', label: 'Short Brief' },
  { id: 'detailed', label: 'Detailed' },
  { id: 'chapter', label: 'Chapter-by-Chapter' },
  { id: 'topic', label: 'Topic Outline' },
  { id: 'key_points', label: 'Key Points' },
  { id: 'definitions', label: 'Definitions' },
  { id: 'formulas', label: 'Formulas & Equations' },
  { id: 'terminology', label: 'Terminology' },
  { id: 'pros_cons', label: 'Pros & Cons' },
  { id: 'comparisons', label: 'Comparisons' },
  { id: 'revision', label: 'Quick Revision' },
  { id: 'exam_focused', label: 'Exam Focused' },
] as const;

export const SummaryView: React.FC<SummaryViewProps> = ({
  sources,
  activeNotebookId,
  onSaveNote,
  onOpenCitation,
}) => {
  const [selectedSourceId, setSelectedSourceId] = useState<string>(sources[0]?.id || '');
  const activeSource = sources.find((s) => s.id === selectedSourceId) || sources[0];

  const [selectedMode, setSelectedMode] = useState<string>('detailed');
  const [copied, setCopied] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(false);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [structuredSummary, setStructuredSummary] = useState<{
    mode: string;
    title: string;
    contentMarkdown: string;
    keyPoints: string[];
    citationsUsed?: string[];
  } | null>(null);
  const [summaryCitations, setSummaryCitations] = useState<DocumentCitation[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (sources.length > 0 && !sources.some((s) => s.id === selectedSourceId)) {
      setSelectedSourceId(sources[0].id);
      setStructuredSummary(null);
      setSummaryCitations([]);
    }
  }, [sources, selectedSourceId]);

  useEffect(() => {
    return () => {
      if (audioEl) {
        audioEl.pause();
      }
    };
  }, [audioEl]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStopAudio = () => {
    if (audioEl) {
      audioEl.pause();
      audioEl.currentTime = 0;
      setAudioEl(null);
    }
    setPlayingAudio(false);
  };

  const handleListenOverview = async () => {
    if (!activeSource) return;
    if (playingAudio) {
      handleStopAudio();
      return;
    }
    const textToSpeak = structuredSummary?.contentMarkdown
      ? `${activeSource.title}. ${structuredSummary.contentMarkdown.slice(0, 500)}`
      : `${activeSource.title}. ${activeSource.summary || activeSource.content.slice(0, 350)}`;
    try {
      setPlayingAudio(true);
      setErrorMsg('');
      const base64Audio = await generateSpeechAudio(textToSpeak);
      const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
      setAudioEl(audio);
      audio.onended = () => {
        setPlayingAudio(false);
        setAudioEl(null);
      };
      await audio.play();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Audio synthesis failed.');
      setPlayingAudio(false);
    }
  };

  const handleGenerateModeSummary = async (modeOverride?: string) => {
    if (!activeSource || loadingAI) return;
    const modeToRun = modeOverride || selectedMode;
    setLoadingAI(true);
    setErrorMsg('');
    try {
      const res = await generateSummaryModeApi({
        mode: modeToRun,
        title: activeSource.title,
        sourceContent: activeSource.content,
        notebookId: activeSource.notebookId || activeNotebookId,
        selectedDocumentIds: [activeSource.id],
      });
      setStructuredSummary(res.summary);
      setSummaryCitations(res.citations || []);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to generate AI summary.');
    } finally {
      setLoadingAI(false);
    }
  };

  const handleSaveToNotes = async () => {
    if (!activeSource || !onSaveNote) return;
    const body = structuredSummary
      ? `# ${structuredSummary.title} (${structuredSummary.mode})\n\n${structuredSummary.contentMarkdown}${
          structuredSummary.keyPoints?.length
            ? `\n\n## Key Points\n${structuredSummary.keyPoints.map((kp) => `- ${kp}`).join('\n')}`
            : ''
        }`
      : `# Summary: ${activeSource.title}\n\n${activeSource.summary || activeSource.content.slice(0, 1200)}`;

    await onSaveNote(
      {
        id: `note-${Date.now()}`,
        notebookId: activeSource.notebookId || activeNotebookId || 'nb-1',
        title: `Summary: ${activeSource.title}`,
        content: body,
        updatedAt: new Date().toISOString(),
        tags: ['Summary', structuredSummary?.mode || 'Overview'],
        aiGenerated: true,
      },
      true
    );
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const handleExportMarkdown = () => {
    if (!activeSource) return;
    const markdown = structuredSummary
      ? `# ${structuredSummary.title} (${structuredSummary.mode})\n\n${structuredSummary.contentMarkdown}\n\n## Key Points\n${(
          structuredSummary.keyPoints || []
        )
          .map((kp) => `- ${kp}`)
          .join('\n')}\n`
      : `# ${activeSource.title}\n\n${activeSource.summary || activeSource.content}\n`;

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeSource.title.replace(/[^a-z0-9-_]+/gi, '_')}_summary.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-500" /> Executive AI Document Summaries
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Generate targeted 12-mode summaries grounded in your uploaded documents with citations and note export.
          </p>
        </div>

        {activeSource && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleListenOverview}
              className="px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-semibold text-xs flex items-center gap-1.5 hover:bg-indigo-100"
            >
              {playingAudio ? (
                <>
                  <Square className="w-3.5 h-3.5 text-rose-500 fill-current" />
                  <span>Stop Audio</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" />
                  <span>Listen Briefing</span>
                </>
              )}
            </button>

            {onSaveNote && (
              <button
                onClick={handleSaveToNotes}
                className="px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold text-xs flex items-center gap-1.5 hover:bg-emerald-100"
              >
                {savedNotice ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                <span>{savedNotice ? 'Saved to Notes' : 'Save to Notes'}</span>
              </button>
            )}

            <button
              onClick={handleExportMarkdown}
              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold text-xs flex items-center gap-1.5 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              <Download className="w-4 h-4" /> Export .md
            </button>

            <button
              onClick={() => handleGenerateModeSummary()}
              disabled={loadingAI}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow flex items-center gap-1.5 disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 ${loadingAI ? 'animate-spin' : ''}`} />
              <span>{loadingAI ? 'Analyzing...' : 'Generate Summary'}</span>
            </button>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs rounded-xl">
          {errorMsg}
        </div>
      )}

      {/* Document Selector Pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800">
        {sources.map((src) => {
          const isSelected = src.id === (activeSource?.id || selectedSourceId);
          return (
            <button
              key={src.id}
              onClick={() => {
                setSelectedSourceId(src.id);
                setStructuredSummary(null);
                setSummaryCitations([]);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                isSelected
                  ? 'bg-indigo-500/10 border-indigo-500 text-indigo-700 dark:text-indigo-400'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-400'
              }`}
            >
              📄 {src.title}
            </button>
          );
        })}
      </div>

      {/* 12 Summary Modes Selector */}
      {activeSource && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex flex-wrap gap-1.5 items-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2">
            Summary Mode:
          </span>
          {SUMMARY_MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setSelectedMode(m.id);
                handleGenerateModeSummary(m.id);
              }}
              disabled={loadingAI}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all border ${
                selectedMode === m.id
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {activeSource ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 space-y-6 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                    AI Grounded Summary
                  </span>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-2">
                    {activeSource.title}
                  </h2>
                </div>

                <button
                  onClick={() =>
                    handleCopy(
                      structuredSummary?.contentMarkdown || activeSource.summary || activeSource.content
                    )
                  }
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  title="Copy Summary"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4 text-amber-500" /> Executive Overview
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-sans bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                  {activeSource.summary || activeSource.content.slice(0, 450)}
                </p>
              </div>

              {structuredSummary && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-500 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />{' '}
                      {SUMMARY_MODES.find((m) => m.id === structuredSummary.mode)?.label ||
                        structuredSummary.mode}{' '}
                      Breakdown
                    </h3>
                  </div>

                  <div className="p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {structuredSummary.contentMarkdown}
                  </div>

                  {structuredSummary.keyPoints && structuredSummary.keyPoints.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        Extracted Key Points ({structuredSummary.keyPoints.length})
                      </h4>
                      <ul className="space-y-1.5">
                        {structuredSummary.keyPoints.map((kp, i) => (
                          <li
                            key={i}
                            className="p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 text-xs text-slate-700 dark:text-slate-200 flex gap-2"
                          >
                            <span className="font-bold text-emerald-500">{i + 1}.</span>
                            <span>{kp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {summaryCitations.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Quote className="w-3.5 h-3.5 text-indigo-500" /> Grounded Passages Cited
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {summaryCitations.map((c, idx) => (
                          <button
                            key={idx}
                            onClick={() => onOpenCitation?.(c)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-500/10 border border-slate-200 dark:border-slate-700 text-[11px] text-left transition-colors"
                          >
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">
                              {c.documentTitle}
                              {c.pageNumber ? ` • p.${c.pageNumber}` : ''}
                              {c.slideNumber ? ` • slide ${c.slideNumber}` : ''}
                            </span>
                            {c.excerpt && (
                              <span className="block text-[10px] text-slate-500 truncate max-w-xs">
                                "{c.excerpt}"
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Source Content Preview
                </h3>
                <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-950 font-mono text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
                  {activeSource.content}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-500" /> Key Concept Taxonomy
              </h3>
              <p className="text-xs text-slate-500">
                Terminology extracted from this document:
              </p>

              {activeSource.keyConcepts && activeSource.keyConcepts.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {activeSource.keyConcepts.map((concept, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-xs font-semibold"
                    >
                      {concept}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  No key concepts indexed yet. Run "Terminology" or "Key Points" summary mode above to extract concepts.
                </p>
              )}
            </div>

            <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-950 border border-indigo-500/30 rounded-3xl p-6 text-white space-y-3">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-400" /> Grounded Source Integrity
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                This document is indexed in your active workspace vector storage ({activeSource.chunkCount ?? 1} chunks). All summaries cite passages directly from your source text.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 dark:text-slate-200">No documents available</h3>
          <p className="text-xs text-slate-500 mt-1">
            Upload a document in the Document Library first to generate multi-mode AI summaries.
          </p>
        </div>
      )}
    </div>
  );
};
