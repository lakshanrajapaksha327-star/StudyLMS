import React, { useState } from 'react';
import {
  History as HistoryIcon,
  HelpCircle,
  Layers,
  FileText,
  Bot,
  Calendar,
  Award,
  Trash2,
  Filter,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { HistoryLogItem } from '../types';

interface HistoryViewProps {
  historyLogs: HistoryLogItem[];
  onClearHistory: () => void;
}

const HISTORY_TABS: Array<{ id: 'all' | HistoryLogItem['type']; label: string }> = [
  { id: 'all', label: 'All Activity' },
  { id: 'source_added', label: 'Uploads' },
  { id: 'summary_generated', label: 'Summaries' },
  { id: 'chat_query', label: 'AI Chat' },
  { id: 'quiz_completed', label: 'Quizzes' },
  { id: 'flashcard_review', label: 'Flashcards' },
  { id: 'ai_note_generated', label: 'AI Notes' },
  { id: 'planner_completed', label: 'Study Plan' },
];

export const HistoryView: React.FC<HistoryViewProps> = ({
  historyLogs,
  onClearHistory,
}) => {
  const [filterType, setFilterType] = useState<string>('all');

  const filteredLogs = historyLogs.filter((log) => {
    if (filterType === 'all') return true;
    return log.type === filterType;
  });

  const getLogIcon = (type: HistoryLogItem['type']) => {
    switch (type) {
      case 'quiz_completed':
        return <HelpCircle className="w-4 h-4 text-pink-500" />;
      case 'flashcard_review':
        return <Layers className="w-4 h-4 text-amber-500" />;
      case 'source_added':
        return <FileText className="w-4 h-4 text-blue-500" />;
      case 'summary_generated':
        return <Sparkles className="w-4 h-4 text-cyan-500" />;
      case 'ai_note_generated':
        return <FileText className="w-4 h-4 text-emerald-500" />;
      case 'chat_query':
        return <Bot className="w-4 h-4 text-purple-500" />;
      case 'planner_completed':
        return <CheckCircle2 className="w-4 h-4 text-indigo-500" />;
      default:
        return <HistoryIcon className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <HistoryIcon className="w-6 h-6 text-purple-500" /> Study Session History & Logs
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Review your past AI queries, summaries, practice exam scores, flashcard reviews, and uploaded sources.
          </p>
        </div>

        {historyLogs.length > 0 && (
          <button
            onClick={onClearHistory}
            className="px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-red-500/10 hover:text-red-600 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" /> Clear Logs
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800">
        <span className="text-xs font-bold text-slate-400 flex items-center gap-1 mr-2 shrink-0">
          <Filter className="w-3.5 h-3.5" /> Filter:
        </span>

        {HISTORY_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterType(tab.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border ${
              filterType === tab.id
                ? 'bg-purple-500/10 border-purple-500 text-purple-700 dark:text-purple-400'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredLogs.length > 0 ? (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-xs"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                  {getLogIcon(log.type)}
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                    {log.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {log.details}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-right shrink-0">
                {log.score && (
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1">
                    <Award className="w-3.5 h-3.5" /> {log.score}
                  </span>
                )}
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <HistoryIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-800 dark:text-slate-200">No activity logs found</h3>
          </div>
        )}
      </div>
    </div>
  );
};
