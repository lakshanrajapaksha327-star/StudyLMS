import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  Mic,
  MicOff,
  FileText,
  HelpCircle,
  Layers,
  Presentation,
  Network,
  Volume2,
  ChevronRight,
  Play,
  Copy,
  Check,
  Send,
  Wand2
} from 'lucide-react';
import {
  generateAIFlashcards,
  generateAIQuiz,
  generateAIExplanation,
  generatePowerPointSlides,
  generateDiagram,
  generateSpeechAudio
} from '../services/api';

interface PersistentAiPanelProps {
  activeNotebookTitle?: string;
  sourceContent?: string;
}

export const PersistentAiPanel: React.FC<PersistentAiPanelProps> = ({
  activeNotebookTitle = 'General Study',
  sourceContent = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'quick' | 'voice' | 'slides' | 'diagram'>('quick');

  // Input states
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiOutput, setAiOutput] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  // Voice Chat States
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [voiceMessages, setVoiceMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string }>>([
    { sender: 'ai', text: 'Hi! I am your Voice AI Tutor. Click the microphone to speak your question.' },
  ]);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Initialize Speech Recognition if browser supports
  useEffect(() => {
    let recognition: any = null;
    if (isListening && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onresult = (event: any) => {
        const text = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join('');
        setTranscript(text);
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognition.start();
    }

    return () => {
      if (recognition) recognition.stop();
    };
  }, [isListening]);

  const handleSendVoiceMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;
    const userMsg = textToSend;
    setVoiceMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setTranscript('');
    setLoading(true);

    try {
      const res = await generateAIExplanation(userMsg, 'socratic', sourceContent);
      const aiReply = res.explanation.replace(/#/g, '').slice(0, 300);
      setVoiceMessages((prev) => [...prev, { sender: 'ai', text: aiReply }]);

      // Generate Audio Speech (WAV)
      try {
        const audioBase64 = await generateSpeechAudio(aiReply);
        if (audioBase64) {
          const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
          setIsPlayingAudio(true);
          audio.onended = () => setIsPlayingAudio(false);
          audio.play();
        }
      } catch (err) {
        console.error('Audio playback error', err);
      }
    } catch (err: any) {
      setVoiceMessages((prev) => [
        ...prev,
        { sender: 'ai', text: err?.message || 'Sorry, I could not process your voice request.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = async (actionType: 'summarize' | 'explain' | 'flashcards' | 'quiz') => {
    setLoading(true);
    setAiOutput(null);
    const contentToUse = inputText.trim() || sourceContent;
    if (!contentToUse) {
      setAiOutput({
        type: 'summary',
        title: 'No Input Provided',
        text: 'Please paste an excerpt above or upload a study document in your active notebook first.',
      });
      setLoading(false);
      return;
    }

    try {
      if (actionType === 'summarize') {
        const res = await generateAIExplanation(contentToUse, 'step_by_step');
        setAiOutput({ type: 'summary', title: 'Executive AI Summary', text: res.explanation, takeaways: res.keyTakeaways });
      } else if (actionType === 'explain') {
        const res = await generateAIExplanation(contentToUse, 'eli5');
        setAiOutput({ type: 'explanation', title: 'Simplified Explanation (ELI5)', text: res.explanation, takeaways: res.keyTakeaways });
      } else if (actionType === 'flashcards') {
        const cards = await generateAIFlashcards('Quick Action Deck', contentToUse, 4);
        setAiOutput({ type: 'flashcards', title: `4 Generated Flashcards`, cards });
      } else if (actionType === 'quiz') {
        const questions = await generateAIQuiz('Quick Test', contentToUse, 3);
        setAiOutput({ type: 'quiz', title: `3 Practice Questions`, questions });
      }
    } catch (err: any) {
      setAiOutput({ type: 'summary', title: 'Error', text: err?.message || 'Action failed.' });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSlides = async () => {
    setLoading(true);
    try {
      const topic = inputText.trim() || activeNotebookTitle || 'Core Study Concepts';
      const deck = await generatePowerPointSlides(topic, sourceContent, 4);
      setAiOutput({ type: 'slides', deck });
    } catch (err: any) {
      setAiOutput({ type: 'summary', title: 'Error', text: err?.message || 'Slide generation failed.' });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDiagram = async () => {
    setLoading(true);
    try {
      const topic = inputText.trim() || activeNotebookTitle || 'Concept Hierarchy';
      const diagram = await generateDiagram(topic, 'flowchart');
      setAiOutput({ type: 'diagram', diagram });
    } catch (err: any) {
      setAiOutput({ type: 'summary', title: 'Error', text: err?.message || 'Diagram generation failed.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button on Bottom Right */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white p-3.5 rounded-full shadow-2xl flex items-center gap-2 font-bold text-xs group transition-all hover:scale-105"
        >
          <Sparkles className="w-5 h-5 text-amber-300 animate-spin" />
          <span className="hidden sm:inline">AI Quick Assistant</span>
        </button>
      )}

      {/* Slide-over Right Panel Drawer */}
      {isOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-600 text-white rounded-xl">
                <Wand2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">AI Side Assistant</h3>
                <span className="text-[10px] text-indigo-500 font-semibold">Active: {activeNotebookTitle}</span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50 p-1 text-xs">
            <button
              onClick={() => setActiveTab('quick')}
              className={`flex-1 py-2 rounded-lg font-bold transition-all ${
                activeTab === 'quick' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Quick Actions
            </button>
            <button
              onClick={() => setActiveTab('voice')}
              className={`flex-1 py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1 ${
                activeTab === 'voice' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Mic className="w-3.5 h-3.5 text-amber-500" /> Voice Tutor
            </button>
            <button
              onClick={() => setActiveTab('slides')}
              className={`flex-1 py-2 rounded-lg font-bold transition-all ${
                activeTab === 'slides' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Slides
            </button>
            <button
              onClick={() => setActiveTab('diagram')}
              className={`flex-1 py-2 rounded-lg font-bold transition-all ${
                activeTab === 'diagram' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Diagrams
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {/* 1. QUICK ACTIONS TAB */}
            {activeTab === 'quick' && (
              <div className="space-y-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Select Text or Enter Query
                  </label>
                  <textarea
                    rows={3}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Paste textbook excerpt or study question..."
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Quick Action Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleQuickAction('summarize')}
                    disabled={loading}
                    className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 rounded-xl hover:border-indigo-500 text-left transition-all flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div>
                      <h4 className="font-bold text-indigo-950 dark:text-indigo-200">Summarize</h4>
                      <p className="text-[10px] text-slate-500">Key points</p>
                    </div>
                  </button>

                  <button
                    onClick={() => handleQuickAction('explain')}
                    disabled={loading}
                    className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-xl hover:border-emerald-500 text-left transition-all flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <h4 className="font-bold text-emerald-950 dark:text-emerald-200">Explain (ELI5)</h4>
                      <p className="text-[10px] text-slate-500">Simple analogies</p>
                    </div>
                  </button>

                  <button
                    onClick={() => handleQuickAction('flashcards')}
                    disabled={loading}
                    className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-xl hover:border-amber-500 text-left transition-all flex items-center gap-2"
                  >
                    <Layers className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <h4 className="font-bold text-amber-950 dark:text-amber-200">Flashcards</h4>
                      <p className="text-[10px] text-slate-500">Generate 4 cards</p>
                    </div>
                  </button>

                  <button
                    onClick={() => handleQuickAction('quiz')}
                    disabled={loading}
                    className="p-3 bg-pink-50 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-800/50 rounded-xl hover:border-pink-500 text-left transition-all flex items-center gap-2"
                  >
                    <HelpCircle className="w-4 h-4 text-pink-600 shrink-0" />
                    <div>
                      <h4 className="font-bold text-pink-950 dark:text-pink-200">Generate Quiz</h4>
                      <p className="text-[10px] text-slate-500">3 test questions</p>
                    </div>
                  </button>
                </div>

                {/* Output Area */}
                {loading && (
                  <div className="p-8 text-center text-slate-400 space-y-2">
                    <Sparkles className="w-6 h-6 mx-auto animate-spin text-indigo-500" />
                    <p className="text-xs">AI is processing your query...</p>
                  </div>
                )}

                {aiOutput && !loading && (
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3">
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                      <span>{aiOutput.title}</span>
                    </h4>

                    {aiOutput.text && <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{aiOutput.text}</p>}

                    {aiOutput.cards && (
                      <div className="space-y-2">
                        {aiOutput.cards.map((c: any, i: number) => (
                          <div key={i} className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                            <span className="font-bold text-indigo-600 dark:text-indigo-400 block">Q: {c.question}</span>
                            <span className="text-slate-600 dark:text-slate-300 mt-1 block">A: {c.answer}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {aiOutput.questions && (
                      <div className="space-y-2">
                        {aiOutput.questions.map((q: any, i: number) => (
                          <div key={i} className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                            <span className="font-bold text-pink-600 dark:text-pink-400 block">{i + 1}. {q.question}</span>
                            <span className="text-emerald-600 font-semibold mt-1 block">Correct: {q.correctAnswer}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 2. VOICE TUTOR TAB */}
            {activeTab === 'voice' && (
              <div className="space-y-4">
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-3">
                  <div className="p-2 bg-amber-500 text-slate-950 rounded-xl font-bold">
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-amber-900 dark:text-amber-300">Voice AI Tutor</h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      Speak your questions out loud. AI answers back using Gemini text-to-speech audio.
                    </p>
                  </div>
                </div>

                {/* Voice Messages list */}
                <div className="space-y-2.5 max-h-64 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                  {voiceMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl max-w-[85%] text-xs leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-indigo-600 text-white ml-auto'
                          : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {msg.text}
                    </div>
                  ))}
                  {isPlayingAudio && (
                    <div className="flex items-center gap-2 text-xs text-amber-500 font-bold p-2">
                      <Volume2 className="w-4 h-4 animate-bounce" /> Speaking response...
                    </div>
                  )}
                </div>

                {/* Mic Trigger */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsListening(!isListening)}
                    className={`flex-1 py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                      isListening
                        ? 'bg-rose-600 text-white animate-pulse'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg'
                    }`}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    <span>{isListening ? 'Listening... Speak now' : 'Start Voice Recording'}</span>
                  </button>
                </div>

                {transcript && (
                  <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-300 italic">"{transcript}"</span>
                    <button
                      onClick={() => handleSendVoiceMessage(transcript)}
                      className="p-1.5 bg-indigo-600 text-white rounded-lg"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 3. SLIDES GENERATOR TAB */}
            {activeTab === 'slides' && (
              <div className="space-y-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Presentation Topic
                  </label>
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="e.g. Photosynthesis & Cellular Respiration"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <button
                  onClick={handleGenerateSlides}
                  disabled={loading}
                  className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow"
                >
                  <Presentation className="w-4 h-4" /> Generate Slide Deck
                </button>

                {aiOutput?.deck && (
                  <div className="space-y-3">
                    <h4 className="font-bold text-purple-600">{aiOutput.deck.deckTitle}</h4>
                    {aiOutput.deck.slides?.map((s: any, idx: number) => (
                      <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                        <span className="text-[10px] font-bold text-purple-500 uppercase">Slide {s.slideNumber}: {s.title}</span>
                        <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-700 dark:text-slate-300">
                          {s.bulletPoints?.map((bp: string, i: number) => (
                            <li key={i}>{bp}</li>
                          ))}
                        </ul>
                        <p className="text-[10px] text-slate-400 italic">Speaker Note: {s.speakerNotes}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 4. DIAGRAMS TAB */}
            {activeTab === 'diagram' && (
              <div className="space-y-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Diagram Concept / Flow
                  </label>
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="e.g. Transformer Attention Flow or Water Cycle"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <button
                  onClick={handleGenerateDiagram}
                  disabled={loading}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow"
                >
                  <Network className="w-4 h-4" /> Generate Flowchart / Concept Map
                </button>

                {aiOutput?.diagram && (
                  <div className="space-y-3 p-3 bg-slate-950 text-emerald-400 rounded-2xl border border-slate-800">
                    <h4 className="font-bold text-white text-xs">{aiOutput.diagram.title}</h4>
                    <p className="text-[11px] text-slate-300">{aiOutput.diagram.description}</p>
                    <pre className="p-2.5 bg-slate-900 rounded-xl text-[10px] font-mono text-emerald-300 overflow-x-auto">
                      <code>{aiOutput.diagram.mermaidSyntax}</code>
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
