import React from 'react';
import {
  Sparkles,
  BookOpen,
  Bot,
  Layers,
  HelpCircle,
  FileText,
  ArrowRight,
  ShieldCheck,
  Zap,
  CheckCircle,
  GraduationCap,
  TrendingUp,
  BrainCircuit
} from 'lucide-react';

interface LandingPageProps {
  onStartLearning: () => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onStartLearning,
  onOpenAuth,
}) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Navigation Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-black text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-200 bg-clip-text text-transparent">
              StudyLMS <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">AI Edition</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => onOpenAuth('login')}
              className="text-xs font-bold text-slate-300 hover:text-white px-3 py-2 rounded-lg transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={onStartLearning}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-bold shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition-all hover:scale-[1.02]"
            >
              <span>Launch App</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 px-6 max-w-7xl mx-auto w-full text-center">
        {/* Background Ambient Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none" />

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-6">
          <BrainCircuit className="w-4 h-4 text-indigo-400" />
          <span>NotebookLM + ChatGPT + Notion AI + Quizlet in One Unified Workspace</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight leading-tight max-w-4xl mx-auto mb-6">
          Transform Your PDF Documents into{' '}
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Interactive AI Knowledge Engines
          </span>
        </h1>

        <p className="text-base md:text-lg text-slate-400 max-w-2xl mx-auto mb-8 leading-relaxed">
          Ground AI responses directly in your lecture slides, textbook PDFs, and research notes.
          Generate Quizlet flashcards, practice exam questions, and Notion study notes in seconds.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onStartLearning}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 hover:opacity-90 text-white font-bold text-sm shadow-xl shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
          >
            <span>Explore Demo Workspace</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onOpenAuth('register')}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-sm flex items-center justify-center gap-2 transition-all"
          >
            <GraduationCap className="w-4 h-4 text-indigo-400" />
            <span>Create Free Account</span>
          </button>
        </div>

        {/* Hero Feature Badges */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 text-left max-w-4xl mx-auto">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-200">NotebookLM Grounding</h4>
              <p className="text-[11px] text-slate-400">Zero-hallucination citations</p>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-200">ChatGPT Tutor</h4>
              <p className="text-[11px] text-slate-400">Socratic study coach</p>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-200">Notion AI Notes</h4>
              <p className="text-[11px] text-slate-400">Auto markdown formatting</p>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-200">Quizlet Flashcards</h4>
              <p className="text-[11px] text-slate-400">3D flip active recall</p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Feature Matrix */}
      <section className="py-20 px-6 border-t border-slate-800/80 bg-slate-900/30">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Four World-Class AI Study Workflows in One
            </h2>
            <p className="text-xs md:text-sm text-slate-400">
              Stop switching between 5 different AI tools. StudyLMS combines grounded document parsing, active recall flashcards, and automated exam generation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-indigo-500/50 transition-colors group">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">
                NotebookLM Source Indexing
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Upload PDF textbooks, lecture slides, and Markdown files. AI processes content with vector embeddings to source exact citations and paragraph page numbers.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-purple-500/50 transition-colors group">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <Bot className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors">
                ChatGPT Conversational Tutor
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Choose between Exam Coach, Simple Analogy Teacher, or Strict Examiner personas. Get step-by-step guidance without direct answer giveaways.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-emerald-500/50 transition-colors group">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
                Notion AI Note Summaries
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Format messy lecture notes automatically. Expand concepts, extract key formulas into Markdown LaTeX, and clean up formatting with one click.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-amber-500/50 transition-colors group">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
                Quizlet 3D Active Recall
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Flip through study decks with tactile 3D cards, AI voice pronunciation playback, progress tracking, and mastered vs learning state counters.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-pink-500/50 transition-colors group">
              <div className="w-12 h-12 rounded-2xl bg-pink-500/10 text-pink-400 flex items-center justify-center">
                <HelpCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-pink-300 transition-colors">
                Practice Exam Generator
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Generate practice exams with multiple choice, true/false, and short answer questions. Receive immediate score breakdowns and explanatory feedback.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-cyan-500/50 transition-colors group">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
                Analytics & Study Streaks
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Track your active study streak, total time invested, mastered cards, completed quizzes, and historical audit logs across all notebooks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 py-8 px-6 text-center text-xs text-slate-500">
        <p>© 2026 StudyLMS AI Edition. Built with Gemini 2.5, React, and Tailwind CSS.</p>
      </footer>
    </div>
  );
};
