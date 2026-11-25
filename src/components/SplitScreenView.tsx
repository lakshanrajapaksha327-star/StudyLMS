import React, { useState } from 'react';
import {
  FileText,
  MessageSquareText,
  Maximize2,
  Minimize2,
  X,
  Sparkles,
  Send,
  BookOpen
} from 'lucide-react';
import { SourceDocument, ChatMessage } from '../types';
import { sendStudyChat } from '../services/api';

interface SplitScreenViewProps {
  sources: SourceDocument[];
  activeNotebookTitle?: string;
  onClose: () => void;
}

export const SplitScreenView: React.FC<SplitScreenViewProps> = ({
  sources,
  activeNotebookTitle = 'Study Notebook',
  onClose,
}) => {
  const [selectedSourceId, setSelectedSourceId] = useState<string>(sources[0]?.id || '');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'split-welcome',
      sender: 'assistant',
      text: 'Split-Screen Mode active! I am ready to answer questions about the document open on your left.',
      timestamp: 'Just now',
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedDocument = sources.find((s) => s.id === selectedSourceId) || sources[0];

  const handleSendQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: inputQuery.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputQuery('');
    setLoading(true);

    try {
      const docContext = selectedDocument
        ? `Selected Document: "${selectedDocument.title}"\n${selectedDocument.content}`
        : '';
      const response = await sendStudyChat(newHistory, sources, activeNotebookTitle, 'Standard Tutor');

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: response.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="h-14 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between text-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-xl">
            <Maximize2 className="w-4 h-4 text-white" />
          </div>
          <h2 className="font-bold text-sm">Split-Screen Mode: Document + AI Chat Tutor</h2>
        </div>

        <button
          onClick={onClose}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all flex items-center gap-1.5 text-xs font-semibold"
        >
          <X className="w-4 h-4" /> Exit Split-Screen
        </button>
      </div>

      {/* Main Split Body */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-px bg-slate-800 overflow-hidden">
        {/* Left Pane: Document Reader */}
        <div className="bg-white dark:bg-slate-900 p-6 flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between mb-4 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" />
              <span className="font-bold text-xs text-slate-800 dark:text-slate-200">Grounded Source Reader</span>
            </div>
            <select
              value={selectedSourceId}
              onChange={(e) => setSelectedSourceId(e.target.value)}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
            >
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>

          {selectedDocument ? (
            <div className="prose dark:prose-invert max-w-none text-xs leading-relaxed space-y-4">
              <h1 className="text-xl font-bold">{selectedDocument.title}</h1>
              <p className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 whitespace-pre-wrap font-sans text-slate-700 dark:text-slate-300">
                {selectedDocument.content}
              </p>
            </div>
          ) : (
            <div className="text-center py-20 text-slate-400 text-xs">
              No document selected. Upload a PDF or study document in NotebookLM.
            </div>
          )}
        </div>

        {/* Right Pane: Interactive AI Chat Tutor */}
        <div className="bg-slate-50 dark:bg-slate-950 p-6 flex flex-col justify-between overflow-hidden">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`p-3.5 rounded-2xl text-xs max-w-[85%] leading-relaxed ${
                  m.sender === 'user'
                    ? 'bg-indigo-600 text-white ml-auto'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-xs'
                }`}
              >
                {m.text}
              </div>
            ))}
            {loading && (
              <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4 animate-spin text-indigo-500" />
                <span>AI Tutor is formulating grounded response...</span>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSendQuery} className="flex items-center gap-2">
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Ask AI Tutor about the open document..."
              className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
