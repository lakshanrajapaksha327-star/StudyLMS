import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Volume2,
  VolumeX,
  Bot,
  User,
  GraduationCap,
  HelpCircle,
  Lightbulb,
  FileText,
  Copy,
  Check,
  Plus,
  History,
  Trash2,
  ShieldCheck,
  Archive,
  Square,
  RotateCw,
  Edit3,
  Search,
  Mic,
  MicOff,
  Pause,
  Play,
  Code2,
  ListOrdered,
  ShieldAlert,
} from 'lucide-react';
import { ChatMessage, DocumentCitation, SourceDocument } from '../types';
import {
  sendStudyChat,
  generateSpeechAudio,
  fetchChatHistorySessions,
  fetchChatHistorySessionById,
  deleteChatHistorySession,
  archiveChatSession,
  renameChatSession,
  searchChatSessions,
} from '../services/api';

interface ChatViewProps {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  sources: SourceDocument[];
  notebookId: string;
  notebookTitle: string;
  initialPrompt?: string;
  onConsumeInitialPrompt?: () => void;
  onOpenCitation?: (citation: DocumentCitation) => void;
  isAuthenticated?: boolean;
}

const TUTOR_PERSONAS = [
  { name: 'Standard Tutor', icon: Bot, desc: 'Balanced & thorough study assistant' },
  { name: 'Socratic Tutor', icon: HelpCircle, desc: 'Guides you with questions' },
  { name: 'Simple Explanation Tutor', icon: Lightbulb, desc: 'Analogy-driven & plain language' },
  { name: 'Exam Preparation Tutor', icon: GraduationCap, desc: 'Exam traps, marks & active recall' },
  { name: 'Strict Examiner', icon: ShieldAlert, desc: 'Rigorous grading & rubric checks' },
  { name: 'Step-by-Step Tutor', icon: ListOrdered, desc: 'Worked solutions one step at a time' },
  { name: 'Programming Tutor', icon: Code2, desc: 'Algorithms, debugging & complexity' },
];

const TTS_VOICES = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Aoede'];

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  setMessages,
  sources,
  notebookId,
  notebookTitle,
  initialPrompt,
  onConsumeInitialPrompt,
  onOpenCitation,
  isAuthenticated = false,
}) => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [persona, setPersona] = useState<string>('Standard Tutor');
  const [strictGrounded, setStrictGrounded] = useState(true);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(undefined);
  const [savedSessions, setSavedSessions] = useState<any[]>([]);
  const [showSessionsDrawer, setShowSessionsDrawer] = useState(false);
  const [sessionSearch, setSessionSearch] = useState('');
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameTitleValue, setRenameTitleValue] = useState('');

  // Speech / TTS & STT state
  const [ttsVoice, setTtsVoice] = useState('Kore');
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [isAudioPaused, setIsAudioPaused] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [sttNotice, setSttNotice] = useState('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchChatHistorySessions()
        .then((list) => setSavedSessions(list || []))
        .catch(() => {});
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (initialPrompt && initialPrompt.trim()) {
      const p = initialPrompt;
      onConsumeInitialPrompt?.();
      handleSend(p);
    }
  }, [initialPrompt]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      audioRef.current?.pause();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const handleNewChat = () => {
    abortControllerRef.current?.abort();
    setActiveSessionId(undefined);
    setMessages([]);
  };

  const handleLoadSession = async (sessionId: string) => {
    try {
      const sess = await fetchChatHistorySessionById(sessionId);
      if (sess) {
        setActiveSessionId(sess.id);
        setPersona(sess.persona || 'Standard Tutor');
        setMessages(
          (sess.messages || []).map((m: any, idx: number) => ({
            id: m.id || `m-${idx}`,
            sender: m.sender || m.role || 'assistant',
            text: m.text || m.message || '',
            timestamp: m.timestamp || '',
            citations: m.citations,
            sourcesUsed: m.sourcesUsed,
            suggestedQuestions: m.suggestedQuestions,
          }))
        );
        setShowSessionsDrawer(false);
      }
    } catch {
      // ignore
    }
  };

  const handleSearchSessions = async (q: string) => {
    setSessionSearch(q);
    if (!isAuthenticated) return;
    try {
      if (!q.trim()) {
        const list = await fetchChatHistorySessions();
        setSavedSessions(list || []);
      } else {
        const list = await searchChatSessions(q.trim());
        setSavedSessions(list || []);
      }
    } catch {
      // ignore
    }
  };

  const handleRenameSession = async (sessionId: string) => {
    if (!renameTitleValue.trim()) {
      setRenamingSessionId(null);
      return;
    }
    try {
      const updated = await renameChatSession(sessionId, renameTitleValue.trim());
      setSavedSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, title: updated?.title || renameTitleValue.trim() } : s))
      );
    } catch {
      // ignore
    } finally {
      setRenamingSessionId(null);
    }
  };

  const handleArchiveSession = async (sessionId: string, nextArchived: boolean) => {
    try {
      await archiveChatSession(sessionId, nextArchived);
      setSavedSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, isArchived: nextArchived } : s))
      );
    } catch {
      // ignore
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteChatHistorySession(sessionId);
      setSavedSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) handleNewChat();
    } catch {
      // ignore
    }
  };

  const executeChatRequest = async (historyToSend: ChatMessage[]) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setLoading(true);

    try {
      const res = await sendStudyChat(historyToSend, sources, notebookTitle, persona, {
        notebookId,
        selectedDocumentIds: selectedDocIds.length > 0 ? selectedDocIds : undefined,
        sessionId: activeSessionId,
        strictGrounded,
        signal: controller.signal,
      });

      if (res.sessionId && !activeSessionId) {
        setActiveSessionId(res.sessionId);
        if (isAuthenticated) {
          fetchChatHistorySessions().then((list) => setSavedSessions(list || [])).catch(() => {});
        }
      }

      const aiMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        text: res.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedQuestions: res.suggestedQuestions,
        sourcesUsed: res.sourcesUsed,
        citations: res.citations,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-aborted-${Date.now()}`,
            sender: 'assistant',
            text: 'Generation stopped by user.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } else {
        const errorMsg: ChatMessage = {
          id: `msg-err-${Date.now()}`,
          sender: 'assistant',
          text: `Unable to generate response: ${err?.message || 'Server error'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } finally {
      abortControllerRef.current = null;
      setLoading(false);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    await executeChatRequest(updatedMessages);
  };

  const handleStopGenerating = () => {
    abortControllerRef.current?.abort();
  };

  const handleRegenerateOrRetry = async (targetMsgIndex: number) => {
    if (loading) return;
    // Trim messages up to the last user prompt before targetMsgIndex
    const prior = messages.slice(0, targetMsgIndex);
    if (prior.length === 0) return;
    setMessages(prior);
    await executeChatRequest(prior);
  };

  const handleToggleVoiceInput = () => {
    setSttNotice('');
    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setSttNotice('Browser Speech-to-Text (Web Speech API) is not supported in this browser. Type your prompt below.');
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((r: any) => r[0]?.transcript || '')
          .join('');
        setInput(transcript);
      };
      recognition.onerror = () => {
        setIsListening(false);
        setSttNotice('Microphone capture stopped or permission denied.');
      };
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
      setIsListening(true);
      recognition.start();
    } catch {
      setIsListening(false);
      setSttNotice('Unable to start browser voice recognition.');
    }
  };

  const handleSpeech = async (msgId: string, text: string) => {
    if (playingAudioId === msgId) {
      audioRef.current?.pause();
      setPlayingAudioId(null);
      setIsAudioPaused(false);
      return;
    }

    try {
      setPlayingAudioId(msgId);
      setIsAudioPaused(false);
      const base64Audio = await generateSpeechAudio(text.slice(0, 800), ttsVoice);
      const audioUrl = `data:audio/wav;base64,${base64Audio}`;

      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      await audio.play();
      audio.onended = () => {
        setPlayingAudioId(null);
        setIsAudioPaused(false);
      };
    } catch {
      setPlayingAudioId(null);
      setIsAudioPaused(false);
    }
  };

  const handlePauseResumeAudio = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current.play().catch(() => {});
      setIsAudioPaused(false);
    } else {
      audioRef.current.pause();
      setIsAudioPaused(true);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleDocFilter = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-5xl mx-auto p-4 md:p-6 relative">
      {/* Persona & Grounding Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 mb-4 shadow-xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">AI Persona Mode</span>
            <button
              type="button"
              onClick={() => setStrictGrounded(!strictGrounded)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 border transition-colors ${
                strictGrounded
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
              }`}
              title="Strict Grounded answers only from your uploaded sources"
            >
              <ShieldCheck className="w-3 h-3" />
              {strictGrounded ? 'Strict Grounded RAG' : 'General Study Mode'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500">
              <Volume2 className="w-3.5 h-3.5 text-indigo-500" />
              <select
                value={ttsVoice}
                onChange={(e) => setTtsVoice(e.target.value)}
                title="Read-Aloud TTS Voice"
                className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-1.5 py-0.5 text-[11px] text-slate-700 dark:text-slate-200"
              >
                {TTS_VOICES.map((v) => (
                  <option key={v} value={v}>
                    Voice: {v}
                  </option>
                ))}
              </select>
            </label>

            {isAuthenticated && (
              <button
                type="button"
                onClick={() => setShowSessionsDrawer(!showSessionsDrawer)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1"
              >
                <History className="w-3.5 h-3.5" /> Chats ({savedSessions.length})
              </button>
            )}
            <button
              type="button"
              onClick={handleNewChat}
              className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> New Chat
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
          {TUTOR_PERSONAS.map((p) => {
            const Icon = p.icon;
            const isSelected = persona === p.name;
            return (
              <button
                key={p.name}
                onClick={() => setPersona(p.name)}
                title={p.desc}
                className={`p-2 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-500 text-indigo-900 dark:text-indigo-100 font-semibold'
                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1 mb-0.5">
                  <Icon className={`w-3 h-3 shrink-0 ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                  <span className="text-[11px] font-bold truncate">{p.name}</span>
                </div>
                <p className="text-[9px] text-slate-500 dark:text-slate-400 line-clamp-1">{p.desc}</p>
              </button>
            );
          })}
        </div>

        {sources.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pt-1 text-[10px]">
            <span className="text-slate-400 font-semibold shrink-0">Scope:</span>
            <button
              onClick={() => setSelectedDocIds([])}
              className={`px-2 py-0.5 rounded-full border shrink-0 ${
                selectedDocIds.length === 0
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
              }`}
            >
              All ({sources.length})
            </button>
            {sources.map((s) => (
              <button
                key={s.id}
                onClick={() => toggleDocFilter(s.id)}
                className={`px-2 py-0.5 rounded-full border shrink-0 truncate max-w-[160px] ${
                  selectedDocIds.includes(s.id)
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                }`}
              >
                {s.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Saved Sessions Drawer */}
      {showSessionsDrawer && (
        <div className="mb-4 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg max-h-60 overflow-y-auto space-y-2">
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Saved Conversations</span>
            <div className="relative w-52">
              <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                value={sessionSearch}
                onChange={(e) => handleSearchSessions(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-7 pr-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px]"
              />
            </div>
          </div>

          {savedSessions.length === 0 ? (
            <p className="text-xs text-slate-400 px-2 py-2">No saved conversations found.</p>
          ) : (
            savedSessions.map((sess) => (
              <div
                key={sess.id}
                className={`flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs ${
                  sess.id === activeSessionId ? 'bg-indigo-500/10 border border-indigo-500/20' : ''
                }`}
              >
                {renamingSessionId === sess.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleRenameSession(sess.id);
                    }}
                    className="flex items-center gap-1.5 flex-1 mr-2"
                  >
                    <input
                      type="text"
                      autoFocus
                      value={renameTitleValue}
                      onChange={(e) => setRenameTitleValue(e.target.value)}
                      className="flex-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-xs"
                    />
                    <button type="submit" className="px-2 py-1 bg-indigo-600 text-white rounded text-[10px] font-bold">
                      Save
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => handleLoadSession(sess.id)}
                    className="text-left font-semibold truncate flex-1 text-slate-800 dark:text-slate-200 flex items-center gap-1.5"
                  >
                    <span className="truncate">{sess.title}</span>
                    {sess.isArchived && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500">
                        Archived
                      </span>
                    )}
                  </button>
                )}

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => {
                      setRenamingSessionId(sess.id);
                      setRenameTitleValue(sess.title);
                    }}
                    className="p-1 text-slate-400 hover:text-indigo-500"
                    title="Rename"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleArchiveSession(sess.id, !sess.isArchived)}
                    className="p-1 text-slate-400 hover:text-amber-500"
                    title={sess.isArchived ? 'Unarchive' : 'Archive'}
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteSession(sess.id)}
                    className="p-1 text-slate-400 hover:text-rose-500"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Messages Thread Container */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <Bot className="w-12 h-12 text-indigo-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              AI Study Tutor Ready ({persona})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 mb-6">
              Ask grounded questions about <strong className="text-slate-700 dark:text-slate-300">{notebookTitle}</strong> or your uploaded sources.
            </p>

            <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
              <button
                onClick={() => handleSend('Summarize the key concepts from my uploaded documents')}
                className="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-full"
              >
                Summarize uploaded sources
              </button>
              <button
                onClick={() => handleSend('Generate 3 exam questions from my study material')}
                className="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-full"
              >
                Generate 3 exam questions
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg, msgIndex) => {
            const isUser = msg.sender === 'user';
            const isErrorLike =
              !isUser &&
              (msg.text.startsWith('Unable to generate response:') ||
                msg.text === 'Generation stopped by user.');

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} animate-fadeIn`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed shadow-xs ${
                    isUser
                      ? 'bg-indigo-600 text-white rounded-br-none'
                      : isErrorLike
                      ? 'bg-rose-500/5 border border-rose-500/30 text-slate-800 dark:text-slate-200 rounded-bl-none'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1 gap-4">
                    <span className="font-bold text-[11px] opacity-80">
                      {isUser ? 'You' : `AI Study Tutor (${persona})`}
                    </span>
                    <span className="text-[10px] opacity-60">{msg.timestamp}</span>
                  </div>

                  <div className="whitespace-pre-wrap font-sans space-y-2">{msg.text}</div>

                  {/* Grounded Citations */}
                  {!isUser && msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 flex-wrap">
                      <FileText className="w-3 h-3 text-indigo-500" />
                      <span className="text-[10px] font-semibold text-slate-400">Citations:</span>
                      {msg.citations.map((cit, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => onOpenCitation?.(cit)}
                          title={cit.excerpt}
                          className="text-[10px] bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 cursor-pointer"
                        >
                          {cit.documentTitle}
                          {cit.pageNumber ? ` p.${cit.pageNumber}` : ''}
                          {cit.slideNumber ? ` slide ${cit.slideNumber}` : ''}
                        </button>
                      ))}
                    </div>
                  )}

                  {!isUser && (!msg.citations || msg.citations.length === 0) && msg.sourcesUsed && msg.sourcesUsed.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 flex-wrap">
                      <FileText className="w-3 h-3 text-indigo-500" />
                      <span className="text-[10px] font-semibold text-slate-400">Sources:</span>
                      {msg.sourcesUsed.map((srcTitle, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800"
                        >
                          {srcTitle}
                        </span>
                      ))}
                    </div>
                  )}

                  {!isUser && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-400">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleSpeech(msg.id, msg.text)}
                          className="hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 transition-colors"
                        >
                          {playingAudioId === msg.id ? (
                            <>
                              <VolumeX className="w-3.5 h-3.5 text-indigo-500 animate-pulse" /> Stop Audio
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5" /> Read Aloud ({ttsVoice})
                            </>
                          )}
                        </button>

                        {playingAudioId === msg.id && (
                          <button
                            onClick={handlePauseResumeAudio}
                            className="hover:text-indigo-500 flex items-center gap-1"
                          >
                            {isAudioPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                            <span>{isAudioPaused ? 'Resume' : 'Pause'}</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleCopy(msg.id, msg.text)}
                          className="hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 transition-colors"
                        >
                          {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                        </button>

                        {(isErrorLike || msgIndex === messages.length - 1) && (
                          <button
                            onClick={() => handleRegenerateOrRetry(msgIndex)}
                            disabled={loading}
                            className="hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 transition-colors"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                            <span>{isErrorLike ? 'Retry' : 'Regenerate'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {!isUser && msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                    <div className="mt-3 pt-2 space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Suggested Follow-ups
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.suggestedQuestions.map((q, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSend(q)}
                            className="text-[11px] bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg text-left transition-colors"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-200 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 animate-spin" />
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-indigo-500 animate-bounce" />
              <span>Retrieving document context & synthesizing response...</span>
              <button
                type="button"
                onClick={handleStopGenerating}
                className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/30 font-bold flex items-center gap-1 hover:bg-rose-500/20"
              >
                <Square className="w-3 h-3 fill-current" /> Stop
              </button>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {sttNotice && (
        <div className="mb-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-600 dark:text-amber-300">
          {sttNotice}
        </div>
      )}

      {/* Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 shadow-md flex items-center gap-2"
      >
        <button
          type="button"
          onClick={handleToggleVoiceInput}
          title={isListening ? 'Stop voice dictation' : 'Voice input (Browser Speech-to-Text)'}
          className={`p-2 rounded-xl transition-colors ${
            isListening
              ? 'bg-rose-600 text-white animate-pulse'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-500'
          }`}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        <input
          type="text"
          placeholder={`Ask AI Study Tutor (${persona})...`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 bg-transparent border-none text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 px-2 py-2 focus:outline-none"
        />

        {loading ? (
          <button
            type="button"
            onClick={handleStopGenerating}
            className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow transition-all flex items-center gap-1.5"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Stop</span>
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow disabled:opacity-40 transition-all flex items-center gap-1.5"
          >
            <span>Send</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        )}
      </form>
    </div>
  );
};
