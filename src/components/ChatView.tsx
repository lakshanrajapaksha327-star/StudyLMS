import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquareText,
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
  RotateCcw
} from 'lucide-react';
import { ChatMessage, SourceDocument } from '../types';
import { sendStudyChat, generateSpeechAudio } from '../services/api';

interface ChatViewProps {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  sources: SourceDocument[];
  notebookTitle: string;
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  setMessages,
  sources,
  notebookTitle,
}) => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [persona, setPersona] = useState<string>('Standard Tutor');
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const personas = [
    { name: 'Standard Tutor', icon: Bot, desc: 'Balanced & thorough study assistant' },
    { name: 'Socratic Tutor', icon: HelpCircle, desc: 'Guides you with questions' },
    { name: 'Exam Coach', icon: GraduationCap, desc: 'Focuses on exam traps & recall' },
    { name: 'Simplified Explainer', icon: Lightbulb, desc: 'Analogy-driven (ELI5)' },
  ];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

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
    setLoading(true);

    try {
      const res = await sendStudyChat(updatedMessages, sources, notebookTitle, persona);

      const aiMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        text: res.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedQuestions: res.suggestedQuestions,
        sourcesUsed: res.sourcesUsed,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `msg-err-${Date.now()}`,
        sender: 'assistant',
        text: `⚠️ Sorry, I encountered an issue generating a study response: ${err?.message || 'Server error'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleSpeech = async (msgId: string, text: string) => {
    if (playingAudioId === msgId) {
      audioRef.current?.pause();
      setPlayingAudioId(null);
      return;
    }

    try {
      setPlayingAudioId(msgId);
      const base64Audio = await generateSpeechAudio(text.slice(0, 800));
      const audioUrl = `data:audio/wav;base64,${base64Audio}`;

      if (audioRef.current) {
        audioRef.current.pause();
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.play();

      audio.onended = () => {
        setPlayingAudioId(null);
      };
    } catch (err) {
      console.error('TTS playback error:', err);
      setPlayingAudioId(null);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-5xl mx-auto p-4 md:p-6">
      {/* Persona Header Switcher */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 mb-4 shadow-xs">
        <div className="flex items-center justify-between mb-2 px-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">AI Persona Mode</span>
          <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
            {sources.length} Sources Grounded
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {personas.map((p) => {
            const Icon = p.icon;
            const isSelected = persona === p.name;
            return (
              <button
                key={p.name}
                onClick={() => setPersona(p.name)}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-500 text-indigo-900 dark:text-indigo-100 font-semibold'
                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold">{p.name}</span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">{p.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Messages Thread Container */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <Bot className="w-12 h-12 text-indigo-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              ChatGPT Study Tutor Ready
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 mb-6">
              Ask anything about <strong className="text-slate-700 dark:text-slate-300">{notebookTitle}</strong> or your uploaded documents.
            </p>

            <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
              <button
                onClick={() => handleSend('Explain the core concept in simple terms')}
                className="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-full"
              >
                💡 Explain core concept in simple terms
              </button>
              <button
                onClick={() => handleSend('Generate 3 potential exam questions')}
                className="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-full"
              >
                🎯 Generate 3 potential exam questions
              </button>
              <button
                onClick={() => handleSend('Give me a memory mnemonic for key steps')}
                className="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-full"
              >
                🧠 Give me a memory mnemonic
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.sender === 'user';
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
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1 gap-4">
                    <span className="font-bold text-[11px] opacity-80">
                      {isUser ? 'You' : `AI Assistant (${persona})`}
                    </span>
                    <span className="text-[10px] opacity-60">{msg.timestamp}</span>
                  </div>

                  {/* Message Content */}
                  <div className="whitespace-pre-wrap font-sans space-y-2">{msg.text}</div>

                  {/* Sources Used Badge */}
                  {!isUser && msg.sourcesUsed && msg.sourcesUsed.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 flex-wrap">
                      <FileText className="w-3 h-3 text-indigo-500" />
                      <span className="text-[10px] font-semibold text-slate-400">Cited Sources:</span>
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

                  {/* Actions (Copy & Speech Audio) */}
                  {!isUser && (
                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-400">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleSpeech(msg.id, msg.text)}
                          className="hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 transition-colors"
                          title="Listen with AI Voice"
                        >
                          {playingAudioId === msg.id ? (
                            <>
                              <VolumeX className="w-3.5 h-3.5 text-indigo-500 animate-pulse" /> Stop Voice
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5" /> Listen Audio
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handleCopy(msg.id, msg.text)}
                          className="hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 transition-colors"
                        >
                          {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Suggested Follow-up Questions */}
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
                            💬 {q}
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
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500 animate-bounce" />
              <span>Gemini 3.6 Flash is synthesizing response...</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 shadow-md flex items-center gap-2"
      >
        <input
          type="text"
          placeholder={`Ask AI Study Assistant (${persona})...`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 bg-transparent border-none text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 px-3 py-2 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow disabled:opacity-40 transition-all flex items-center gap-1.5"
        >
          <span>Send</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
