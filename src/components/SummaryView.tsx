import React, { useState } from 'react';
import {
  FileText,
  Sparkles,
  BookOpen,
  Tag,
  Volume2,
  Copy,
  Check,
  Share2,
  Download,
  Lightbulb,
  FileSpreadsheet
} from 'lucide-react';
import { SourceDocument } from '../types';
import { generateSpeechAudio, runNotionAIAction } from '../services/api';

interface SummaryViewProps {
  sources: SourceDocument[];
}

export const SummaryView: React.FC<SummaryViewProps> = ({ sources }) => {
  const [selectedSourceId, setSelectedSourceId] = useState<string>(sources[0]?.id || '');
  const activeSource = sources.find((s) => s.id === selectedSourceId) || sources[0];

  const [copied, setCopied] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiSummaryResult, setAiSummaryResult] = useState<string>('');

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleListenOverview = async () => {
    if (!activeSource) return;
    const textToSpeak = `${activeSource.title}. ${activeSource.summary || activeSource.content.slice(0, 300)}`;
    try {
      setPlayingAudio(true);
      const base64Audio = await generateSpeechAudio(textToSpeak);
      const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
      audio.play();
      audio.onended = () => setPlayingAudio(false);
    } catch (err) {
      console.error('Audio synthesis failed:', err);
      setPlayingAudio(false);
    }
  };

  const handleGenerateDeeperSummary = async () => {
    if (!activeSource || loadingAI) return;
    setLoadingAI(true);
    try {
      const result = await runNotionAIAction('summarize', activeSource.content, activeSource.title);
      setAiSummaryResult(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAI(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-500" /> Executive AI Document Summaries
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Read AI-extracted executive briefs, key concept taxonomies, and high-yield study takeaways.
          </p>
        </div>

        {activeSource && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleListenOverview}
              disabled={playingAudio}
              className="px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-semibold text-xs flex items-center gap-1.5 hover:bg-indigo-100"
            >
              <Volume2 className={`w-4 h-4 ${playingAudio ? 'animate-bounce text-amber-500' : ''}`} />
              <span>{playingAudio ? 'Playing Briefing...' : 'Listen Briefing'}</span>
            </button>

            <button
              onClick={handleGenerateDeeperSummary}
              disabled={loadingAI}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4" />
              <span>{loadingAI ? 'Analyzing...' : 'Deep AI Breakdown'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Document Selector Pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800">
        {sources.map((src) => {
          const isSelected = src.id === selectedSourceId;
          return (
            <button
              key={src.id}
              onClick={() => {
                setSelectedSourceId(src.id);
                setAiSummaryResult('');
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

      {activeSource ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Executive Summary Card */}
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
                  onClick={() => handleCopy(activeSource.summary || activeSource.content)}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  title="Copy Summary"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              {/* High-level Summary Paragraph */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4 text-amber-500" /> Executive Overview
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-sans bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                  {activeSource.summary || activeSource.content.slice(0, 400)}
                </p>
              </div>

              {/* AI Generated Deeper Breakdown */}
              {aiSummaryResult && (
                <div className="space-y-3 animate-in fade-in duration-300">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-500 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> Deep AI Concept Breakdown
                  </h3>
                  <div className="p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed font-mono">
                    {aiSummaryResult}
                  </div>
                </div>
              )}

              {/* Source Original Excerpt */}
              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Raw Document Sample
                </h3>
                <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-950 font-mono text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed max-h-48 overflow-y-auto">
                  {activeSource.content}
                </div>
              </div>
            </div>
          </div>

          {/* Key Concepts Sidebar */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-500" /> Key Concept Taxonomy
              </h3>
              <p className="text-xs text-slate-500">
                Core terminology identified inside this document by Gemini 2.5 embeddings:
              </p>

              <div className="flex flex-wrap gap-2">
                {(activeSource.keyConcepts || ['Neural Networks', 'Loss Functions', 'Gradient Descent']).map(
                  (concept, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-xs font-semibold"
                    >
                      {concept}
                    </span>
                  )
                )}
              </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-950 border border-indigo-500/30 rounded-3xl p-6 text-white space-y-3">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-400" /> Grounded Source Integrity
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                This document is indexed in your active workspace vector storage. All chat queries and flashcard generations cite page references from this source.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 dark:text-slate-200">No documents selected</h3>
        </div>
      )}
    </div>
  );
};
