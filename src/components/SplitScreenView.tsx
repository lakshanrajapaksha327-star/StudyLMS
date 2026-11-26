import React, { useState } from 'react';
import { FileText, Maximize2, X, Sparkles, Send } from 'lucide-react';
import { SourceDocument, ChatMessage } from '../types';
import { sendStudyChat } from '../services/api';

interface SplitScreenViewProps {
  sources: SourceDocument[];
  activeNotebookId?: string;
  activeNotebookTitle?: string;
  onClose: () => void;
}

export const SplitScreenView: React.FC<SplitScreenViewProps> = ({
  sources,
  activeNotebookId,
  activeNotebookTitle = 'Study Notebook',
  onClose,
}) => {
  const [selectedSourceId, setSelectedSourceId] = useState<string>(sources[0]?.id || '');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'split-welcome',
      sender: 'assistant',
      text: 'Split-Screen Mode active! Ask questions grounded specifically in the document open on the left.',
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
      const targetSources = selectedDocument ? [selectedDocument] : sources;
      const response = await sendStudyChat(newHistory, targetSources, activeNotebookTitle, 'Standard Tutor', {
        notebookId: activeNotebookId || selectedDocument?.notebookId,
        selectedDocumentIds: selectedDocument ? [selectedDocument.id] : undefined,
        strictGrounded: true,
      });

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: response.text,
        citations: response.citations,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: err?.message || 'Unable to generate grounded response.',
          timestamp: 'Now',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col animate-in fade-in duration-200">
      <div className="h-14 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between text-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-xl">
            <Maximize2 className="w-4 h-4 text-white" />
          </div>
          <h2 className="font-bold text-sm">Split-Screen Mode: Document + Grounded AI Tutor</h2>
        </div>

        <button
          onClick={onClose}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all flex items-center gap-1.5 text-xs font-semibold"
        >
          <X className="w-4 h-4" /> Exit Split-Screen
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-px bg-slate-800 overflow-hidden">
        <div className="bg-white dark:bg-slate-900 p-6 flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between mb-4 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" />
              <span className="font-bold text-xs text-slate-800 dark:text-slate-200">Grounded Source Reader</span>
            </div>
            <select
              value={selectedSourceId}
              onChange={(e) => setSelectedSourceId(e.target.value)}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold max-w-xs"
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
              No document selected. Upload a file in Document Library.
            </div>
          )}
        </div>

        <div className="bg-slate-50 dark:bg-slate-950 p-6 flex flex-col justify-between overflow-hidden">
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
                <div className="whitespace-pre-wrap">{m.text}</div>
                {m.citations && m.citations.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-1">
                    {m.citations.map((c, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500"
                      >
                        {c.documentTitle}
                        {c.pageNumber ? ` p.${c.pageNumber}` : ''}
                        {c.slideNumber ? ` slide ${c.slideNumber}` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4 animate-spin text-indigo-500" />
                <span>Retrieving passages & formulating grounded response...</span>
              </div>
            )}
          </div>

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
