import React, { useState } from 'react';
import {
  Wand2,
  Calculator,
  Code2,
  Quote,
  GraduationCap,
  Network,
  Sparkles,
  Check,
  Copy,
  AlertTriangle,
  Play,
  FileText,
  Search,
  BookOpen,
  ArrowRight,
  Presentation,
  Brain,
  Award,
  Mic,
  Lightbulb,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';
import { SourceDocument } from '../types';
import {
  solveFormula,
  analyzeCode,
  generateCitations,
  predictExamQuestions,
  generatePowerPointSlides,
  generateDiagram,
  generateCheatSheet,
  generateMnemonics,
  generateVivaQuestions,
  evaluateVivaAnswer
} from '../services/api';

interface AiToolkitViewProps {
  sources: SourceDocument[];
}

export const AiToolkitView: React.FC<AiToolkitViewProps> = ({ sources }) => {
  const [activeTab, setActiveTab] = useState<
    'formula' | 'code' | 'citation' | 'exam' | 'slides' | 'diagram' | 'cheatsheet' | 'mnemonics' | 'viva'
  >('formula');

  // Formula state
  const [formulaInput, setFormulaInput] = useState('E = m * c^2');
  const [givenVars, setGivenVars] = useState('c = 3e8 m/s, m = 2 kg');
  const [formulaResult, setFormulaResult] = useState<any>(null);
  const [formulaLoading, setFormulaLoading] = useState(false);

  // Code state
  const [codeSnippet, setCodeSnippet] = useState(`function calculateFibonacci(n) {
  if (n <= 0) return 0;
  if (n == 1) return 1;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) {
    let temp = a + b;
    a = b;
    b = temp;
  }
  return b;
}`);
  const [codeLang, setCodeLang] = useState('javascript');
  const [codeResult, setCodeResult] = useState<any>(null);
  const [codeLoading, setCodeLoading] = useState(false);

  // Citation state
  const [citeTitle, setCiteTitle] = useState(sources[0]?.title || 'Artificial Intelligence: A Modern Approach');
  const [citeAuthor, setCiteAuthor] = useState('Stuart Russell & Peter Norvig');
  const [citeYear, setCiteYear] = useState('2021');
  const [citeUrl, setCiteUrl] = useState('https://pearson.com/ai-modern-approach');
  const [citationResult, setCitationResult] = useState<any>(null);
  const [citeLoading, setCiteLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Exam Predictor state
  const [selectedSourceId, setSelectedSourceId] = useState<string>(sources[0]?.id || 'all');
  const [examResult, setExamResult] = useState<any>(null);
  const [examLoading, setExamLoading] = useState(false);

  // Slides state
  const [slidesTopic, setSlidesTopic] = useState('Neural Networks & Deep Learning Overview');
  const [slideDeck, setSlideDeck] = useState<any>(null);
  const [slidesLoading, setSlidesLoading] = useState(false);

  // Diagram state
  const [diagramTopic, setDiagramTopic] = useState('Transformer Self-Attention Architecture Flow');
  const [diagramType, setDiagramType] = useState('flowchart');
  const [diagramResult, setDiagramResult] = useState<any>(null);
  const [diagramLoading, setDiagramLoading] = useState(false);

  // Cheat Sheet state
  const [sheetTopic, setSheetTopic] = useState('Calculus II & Differential Equations');
  const [cheatSheetResult, setCheatSheetResult] = useState<any>(null);
  const [sheetLoading, setSheetLoading] = useState(false);

  // Mnemonics state
  const [mnemonicsTopic, setMnemonicsTopic] = useState('Taxonomy Biological Classification');
  const [mnemonicsItems, setMnemonicsItems] = useState('Domain, Kingdom, Phylum, Class, Order, Family, Genus, Species');
  const [mnemonicsResult, setMnemonicsResult] = useState<any>(null);
  const [mnemonicsLoading, setMnemonicsLoading] = useState(false);

  // Viva Examination state
  const [vivaSubject, setVivaSubject] = useState('Organic Chemistry & Molecular Structures');
  const [vivaQuestions, setVivaQuestions] = useState<any[]>([]);
  const [vivaLoading, setVivaLoading] = useState(false);
  const [vivaAnswerInputs, setVivaAnswerInputs] = useState<Record<string, string>>({});
  const [vivaEvaluations, setVivaEvaluations] = useState<Record<string, any>>({});
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);

  // Handlers
  const handleSolveFormula = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formulaInput.trim()) return;
    setFormulaLoading(true);
    try {
      const res = await solveFormula(formulaInput, givenVars);
      setFormulaResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setFormulaLoading(false);
    }
  };

  const handleAnalyzeCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeSnippet.trim()) return;
    setCodeLoading(true);
    try {
      const res = await analyzeCode(codeSnippet, codeLang);
      setCodeResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setCodeLoading(false);
    }
  };

  const handleGenerateCitations = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!citeTitle.trim()) return;
    setCiteLoading(true);
    try {
      const res = await generateCitations(citeTitle, citeAuthor, citeYear, citeUrl);
      setCitationResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setCiteLoading(false);
    }
  };

  const handlePredictExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setExamLoading(true);

    let contentToAnalyze = '';
    if (selectedSourceId === 'all') {
      contentToAnalyze = sources.map((s) => `[Document: ${s.title}]\n${s.content}`).join('\n\n');
    } else {
      const doc = sources.find((s) => s.id === selectedSourceId);
      contentToAnalyze = doc ? doc.content : 'No content available';
    }

    try {
      const res = await predictExamQuestions(contentToAnalyze || 'Sample lecture on machine learning');
      setExamResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setExamLoading(false);
    }
  };

  const handleGenerateSlides = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slidesTopic.trim()) return;
    setSlidesLoading(true);
    try {
      const deck = await generatePowerPointSlides(slidesTopic, sources[0]?.content || '', 5);
      setSlideDeck(deck);
    } catch (err) {
      console.error(err);
    } finally {
      setSlidesLoading(false);
    }
  };

  const handleGenerateDiagram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diagramTopic.trim()) return;
    setDiagramLoading(true);
    try {
      const diag = await generateDiagram(diagramTopic, diagramType);
      setDiagramResult(diag);
    } catch (err) {
      console.error(err);
    } finally {
      setDiagramLoading(false);
    }
  };

  const handleGenerateCheatSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetTopic.trim()) return;
    setSheetLoading(true);
    try {
      const cs = await generateCheatSheet(sheetTopic, sources[0]?.content || '');
      setCheatSheetResult(cs);
    } catch (err) {
      console.error(err);
    } finally {
      setSheetLoading(false);
    }
  };

  const handleGenerateMnemonics = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mnemonicsTopic.trim()) return;
    setMnemonicsLoading(true);
    try {
      const items = mnemonicsItems.split(',').map((s) => s.trim()).filter(Boolean);
      const res = await generateMnemonics(mnemonicsTopic, items);
      setMnemonicsResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setMnemonicsLoading(false);
    }
  };

  const handleGenerateViva = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vivaSubject.trim()) return;
    setVivaLoading(true);
    try {
      const qList = await generateVivaQuestions(vivaSubject);
      setVivaQuestions(qList);
    } catch (err) {
      console.error(err);
    } finally {
      setVivaLoading(false);
    }
  };

  const handleEvaluateViva = async (q: any) => {
    const userAns = vivaAnswerInputs[q.id || q.question];
    if (!userAns || !userAns.trim()) return;
    setEvaluatingId(q.id || q.question);
    try {
      const evalRes = await evaluateVivaAnswer(q.question, userAns, q.expectedKeywords || []);
      setVivaEvaluations((prev) => ({ ...prev, [q.id || q.question]: evalRes }));
    } catch (err) {
      console.error(err);
    } finally {
      setEvaluatingId(null);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Wand2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" /> AI STEM & Research Toolkit
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            PowerPoint Slide Deck Generator, Mermaid Flowcharts, Viva Voce Exams, Step-by-Step Formula Solvers, Code Bug Finders, Cheat Sheets, and Mnemonics.
          </p>
        </div>

        {/* Toolkit Nav Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('formula')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'formula'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Calculator className="w-3.5 h-3.5 text-indigo-500" /> Formulas
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'code'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Code2 className="w-3.5 h-3.5 text-indigo-500" /> Code Bugs
          </button>
          <button
            onClick={() => setActiveTab('slides')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'slides'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Presentation className="w-3.5 h-3.5 text-purple-500" /> Slide Decks
          </button>
          <button
            onClick={() => setActiveTab('diagram')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'diagram'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Network className="w-3.5 h-3.5 text-emerald-500" /> Flowcharts
          </button>
          <button
            onClick={() => setActiveTab('cheatsheet')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'cheatsheet'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-amber-500" /> Cheat Sheets
          </button>
          <button
            onClick={() => setActiveTab('mnemonics')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'mnemonics'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Brain className="w-3.5 h-3.5 text-pink-500" /> Mnemonics
          </button>
          <button
            onClick={() => setActiveTab('viva')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'viva'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Award className="w-3.5 h-3.5 text-cyan-500" /> Oral Viva Exam
          </button>
          <button
            onClick={() => setActiveTab('citation')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'citation'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Quote className="w-3.5 h-3.5 text-indigo-500" /> Citations
          </button>
          <button
            onClick={() => setActiveTab('exam')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'exam'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5 text-indigo-500" /> Exam Predictor
          </button>
        </div>
      </div>

      {/* 1. FORMULA SOLVER */}
      {activeTab === 'formula' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleSolveFormula} className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-indigo-500" /> Enter Formula or Equation
            </h2>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Equation / Expression
              </label>
              <input
                type="text"
                value={formulaInput}
                onChange={(e) => setFormulaInput(e.target.value)}
                placeholder="e.g. F = G * (m1 * m2) / r^2 or integral of sin(x)"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Known Variables / Values (Optional)
              </label>
              <input
                type="text"
                value={givenVars}
                onChange={(e) => setGivenVars(e.target.value)}
                placeholder="e.g. m1 = 5, m2 = 10, r = 2"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              type="submit"
              disabled={formulaLoading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-xs transition-all shadow flex items-center justify-center gap-2"
            >
              {formulaLoading ? <Sparkles className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Solve Step-by-Step
            </button>
          </form>

          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            {formulaResult ? (
              <div className="space-y-4">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 rounded-xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                    Formula Identified
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {formulaResult.formulaName}
                  </h3>
                  <code className="text-xs font-mono text-indigo-700 dark:text-indigo-300 block mt-1">
                    {formulaResult.standardFormulaLatex}
                  </code>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Step-by-Step Derivation</h4>
                  <div className="space-y-2">
                    {formulaResult.solutionSteps?.map((step: string, idx: number) => (
                      <div key={idx} className="flex gap-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{idx + 1}.</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Final Answer
                    </span>
                    <p className="text-sm font-bold font-mono text-emerald-900 dark:text-emerald-200">
                      {formulaResult.finalAnswer}
                    </p>
                  </div>
                  {formulaResult.unitCheck && (
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-1 rounded-md font-medium">
                      Units: {formulaResult.unitCheck}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400 text-xs">
                <Calculator className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2 stroke-1" />
                Enter a math, physics, or chemistry equation to receive a full step-by-step breakdown.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. CODE EXPLAINER & BUG FINDER */}
      {activeTab === 'code' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleAnalyzeCode} className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Code2 className="w-4 h-4 text-indigo-500" /> Source Code Snippet
              </h2>
              <select
                value={codeLang}
                onChange={(e) => setCodeLang(e.target.value)}
                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold"
              >
                <option value="javascript">JavaScript / TypeScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="php">PHP</option>
                <option value="csharp">C#</option>
                <option value="cpp">C++</option>
              </select>
            </div>
            <textarea
              rows={10}
              value={codeSnippet}
              onChange={(e) => setCodeSnippet(e.target.value)}
              className="w-full p-3 bg-slate-950 text-emerald-400 rounded-xl text-xs font-mono border border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Paste code snippet here..."
            />
            <button
              type="submit"
              disabled={codeLoading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-xs transition-all shadow flex items-center justify-center gap-2"
            >
              {codeLoading ? <Sparkles className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Explain Code & Detect Bugs
            </button>
          </form>

          <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 overflow-y-auto max-h-[520px]">
            {codeResult ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1">Code Overview</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    {codeResult.overview}
                  </p>
                </div>

                {/* Bugs Detected */}
                {codeResult.bugsFound?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> Issues & Bugs Detected ({codeResult.bugsFound.length})
                    </h3>
                    <div className="space-y-2">
                      {codeResult.bugsFound.map((bug: any, idx: number) => (
                        <div key={idx} className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 dark:text-slate-100">{bug.issue}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-amber-200 text-amber-900">
                              {bug.severity}
                            </span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300 text-[11px]">{bug.fixSuggestion}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Corrected Code */}
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1">Refactored & Corrected Code</h3>
                  <pre className="p-3 bg-slate-950 text-emerald-300 rounded-xl text-xs font-mono overflow-x-auto border border-slate-800">
                    <code>{codeResult.correctedCode}</code>
                  </pre>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400 text-xs">
                <Code2 className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2 stroke-1" />
                Paste code above to get an instant line-by-line explanation, bug detection, and refactored code.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. CITATION GENERATOR */}
      {activeTab === 'citation' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleGenerateCitations} className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-3.5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Quote className="w-4 h-4 text-indigo-500" /> Academic Citation Generator
            </h2>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Source Title</label>
              <input
                type="text"
                value={citeTitle}
                onChange={(e) => setCiteTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Author(s)</label>
                <input
                  type="text"
                  value={citeAuthor}
                  onChange={(e) => setCiteAuthor(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Year</label>
                <input
                  type="text"
                  value={citeYear}
                  onChange={(e) => setCiteYear(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Publisher / URL</label>
              <input
                type="text"
                value={citeUrl}
                onChange={(e) => setCiteUrl(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              />
            </div>
            <button
              type="submit"
              disabled={citeLoading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-xs transition-all shadow flex items-center justify-center gap-2"
            >
              {citeLoading ? <Sparkles className="w-4 h-4 animate-spin" /> : <Quote className="w-4 h-4" />}
              Generate All Citation Styles
            </button>
          </form>

          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-3">
            {citationResult ? (
              Object.entries(citationResult).map(([styleKey, text]) => (
                <div key={styleKey} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      {styleKey.toUpperCase()}
                    </span>
                    <p className="text-xs text-slate-800 dark:text-slate-200 mt-1 font-serif leading-relaxed">
                      {text as string}
                    </p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(text as string, styleKey)}
                    className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-all shrink-0"
                    title="Copy citation"
                  >
                    {copiedKey === styleKey ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-slate-400 text-xs">
                <Quote className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2 stroke-1" />
                Fill in source details to instantly generate APA, Harvard, IEEE, MLA, and Chicago citations.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. AI EXAM PREDICTOR */}
      {activeTab === 'exam' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-indigo-500" /> AI Exam Question Predictor
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Analyzes uploaded study materials to predict high-likelihood exam questions with scoring model answers.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                value={selectedSourceId}
                onChange={(e) => setSelectedSourceId(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
              >
                <option value="all">All Grounded Documents ({sources.length})</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>

              <button
                onClick={handlePredictExam}
                disabled={examLoading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-xs transition-all shadow flex items-center gap-1.5 shrink-0"
              >
                {examLoading ? <Sparkles className="w-4 h-4 animate-spin" /> : <GraduationCap className="w-4 h-4" />}
                Predict Questions
              </button>
            </div>
          </div>

          {examResult && (
            <div className="space-y-4">
              <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 rounded-2xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Exam Intelligence Summary
                </span>
                <p className="text-xs text-slate-800 dark:text-slate-200 mt-1 leading-relaxed">
                  {examResult.examSummary}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {examResult.predictedQuestions?.map((q: any, idx: number) => (
                  <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 font-bold text-xs flex items-center justify-center">
                          Q{idx + 1}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {q.type}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300">
                          {q.difficulty}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/40">
                        <span>{q.probabilityPercent}% Likely</span>
                      </div>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {q.questionText}
                    </h3>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Ideal Scoring Answer
                      </span>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {q.idealModelAnswer}
                      </p>
                    </div>

                    {q.commonMistakesToAvoid && (
                      <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800/40 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                        <span><strong>Watch out:</strong> {q.commonMistakesToAvoid}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. AI SLIDE DECK GENERATOR */}
      {activeTab === 'slides' && (
        <div className="space-y-6">
          <form onSubmit={handleGenerateSlides} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Presentation className="w-4 h-4 text-purple-500" /> AI PowerPoint & Slide Deck Generator
            </h2>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Presentation Topic</label>
              <input
                type="text"
                value={slidesTopic}
                onChange={(e) => setSlidesTopic(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              />
            </div>
            <button
              type="submit"
              disabled={slidesLoading}
              className="py-2.5 px-6 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold text-xs shadow flex items-center gap-2"
            >
              {slidesLoading ? <Sparkles className="w-4 h-4 animate-spin" /> : <Presentation className="w-4 h-4" />}
              Generate 5-Slide Presentation Deck
            </button>
          </form>

          {slideDeck && (
            <div className="space-y-4">
              <div className="p-4 bg-purple-950/40 border border-purple-800/60 rounded-2xl text-purple-200">
                <h3 className="text-base font-bold text-white">{slideDeck.deckTitle}</h3>
                {slideDeck.subtitle && <p className="text-xs text-purple-300 mt-1">{slideDeck.subtitle}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {slideDeck.slides?.map((slide: any, idx: number) => (
                  <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
                    <span className="px-2.5 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 font-bold text-[10px] rounded-full uppercase tracking-wider">
                      Slide {slide.slideNumber}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{slide.title}</h4>
                    <ul className="list-disc list-inside space-y-1 text-xs text-slate-700 dark:text-slate-300">
                      {slide.bulletPoints?.map((bp: string, i: number) => (
                        <li key={i}>{bp}</li>
                      ))}
                    </ul>
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-[11px] text-slate-500 italic">
                      <strong>Speaker Notes:</strong> {slide.speakerNotes}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. MERMAID DIAGRAMS */}
      {activeTab === 'diagram' && (
        <div className="space-y-6">
          <form onSubmit={handleGenerateDiagram} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Network className="w-4 h-4 text-emerald-500" /> AI Flowchart & Concept Map Generator
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Concept Topic</label>
                <input
                  type="text"
                  value={diagramTopic}
                  onChange={(e) => setDiagramTopic(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Type</label>
                <select
                  value={diagramType}
                  onChange={(e) => setDiagramType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                >
                  <option value="flowchart">Flowchart</option>
                  <option value="sequence">Sequence Diagram</option>
                  <option value="mindmap">Mind Map</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={diagramLoading}
              className="py-2.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-xs shadow flex items-center gap-2"
            >
              {diagramLoading ? <Sparkles className="w-4 h-4 animate-spin" /> : <Network className="w-4 h-4" />}
              Generate Diagram Syntax & Map
            </button>
          </form>

          {diagramResult && (
            <div className="p-6 bg-slate-950 text-emerald-400 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white">{diagramResult.title}</h3>
              <p className="text-xs text-slate-300">{diagramResult.description}</p>
              <pre className="p-4 bg-slate-900 rounded-xl font-mono text-xs text-emerald-300 overflow-x-auto border border-slate-800">
                <code>{diagramResult.mermaidSyntax}</code>
              </pre>
            </div>
          )}
        </div>
      )}

      {/* 7. CHEAT SHEETS */}
      {activeTab === 'cheatsheet' && (
        <div className="space-y-6">
          <form onSubmit={handleGenerateCheatSheet} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-500" /> AI High-Yield Exam Cheat Sheet
            </h2>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Subject / Chapter</label>
              <input
                type="text"
                value={sheetTopic}
                onChange={(e) => setSheetTopic(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              />
            </div>
            <button
              type="submit"
              disabled={sheetLoading}
              className="py-2.5 px-6 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold text-xs shadow flex items-center gap-2"
            >
              {sheetLoading ? <Sparkles className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Compile Dense Cheat Sheet
            </button>
          </form>

          {cheatSheetResult && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
              <h3 className="text-base font-bold text-amber-600">{cheatSheetResult.subject} Reference Sheet</h3>

              {/* Key Terms */}
              <div className="space-y-2">
                <h4 className="font-bold text-xs uppercase text-slate-400">Key Terms & Vocabulary</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {cheatSheetResult.keyTerms?.map((kt: any, i: number) => (
                    <div key={i} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                      <strong className="text-slate-900 dark:text-slate-100 block">{kt.term}</strong>
                      <span className="text-slate-600 dark:text-slate-300 mt-0.5 block">{kt.definition}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Formulas */}
              <div className="space-y-2">
                <h4 className="font-bold text-xs uppercase text-slate-400">Critical Formulas</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {cheatSheetResult.formulas?.map((f: any, i: number) => (
                    <div key={i} className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 text-xs">
                      <span className="font-bold text-amber-900 dark:text-amber-200 block">{f.name}</span>
                      <code className="font-mono text-amber-700 dark:text-amber-300 font-bold text-sm my-1 block">{f.formula}</code>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 8. MNEMONICS */}
      {activeTab === 'mnemonics' && (
        <div className="space-y-6">
          <form onSubmit={handleGenerateMnemonics} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Brain className="w-4 h-4 text-pink-500" /> AI Memory Mnemonics & Acronyms
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Topic</label>
                <input
                  type="text"
                  value={mnemonicsTopic}
                  onChange={(e) => setMnemonicsTopic(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Comma-Separated Items</label>
                <input
                  type="text"
                  value={mnemonicsItems}
                  onChange={(e) => setMnemonicsItems(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={mnemonicsLoading}
              className="py-2.5 px-6 bg-pink-600 hover:bg-pink-700 text-white rounded-xl font-semibold text-xs shadow flex items-center gap-2"
            >
              {mnemonicsLoading ? <Sparkles className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              Generate Memory Tricks
            </button>
          </form>

          {mnemonicsResult?.mnemonics && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {mnemonicsResult.mnemonics.map((m: any, idx: number) => (
                <div key={idx} className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-2">
                  <span className="text-[10px] font-bold uppercase text-pink-500 tracking-wider block">{m.type}</span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{m.mnemonicText}</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{m.breakdown}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 9. ORAL VIVA VOCE EXAM */}
      {activeTab === 'viva' && (
        <div className="space-y-6">
          <form onSubmit={handleGenerateViva} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Award className="w-4 h-4 text-cyan-500" /> Oral Viva Voce Exam & AI Scoring
            </h2>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Exam Subject</label>
              <input
                type="text"
                value={vivaSubject}
                onChange={(e) => setVivaSubject(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              />
            </div>
            <button
              type="submit"
              disabled={vivaLoading}
              className="py-2.5 px-6 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-semibold text-xs shadow flex items-center gap-2"
            >
              {vivaLoading ? <Sparkles className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
              Start Viva Oral Examination
            </button>
          </form>

          {vivaQuestions.length > 0 && (
            <div className="space-y-4">
              {vivaQuestions.map((q: any, idx: number) => {
                const key = q.id || q.question;
                const evaluation = vivaEvaluations[key];
                return (
                  <div key={idx} className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-3">
                    <span className="font-bold text-cyan-600 dark:text-cyan-400 text-xs">Examiner Question #{idx + 1}</span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{q.question}</h3>

                    <textarea
                      rows={3}
                      value={vivaAnswerInputs[key] || ''}
                      onChange={(e) => setVivaAnswerInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder="Type or speak your oral answer response here..."
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    />

                    <button
                      onClick={() => handleEvaluateViva(q)}
                      disabled={evaluatingId === key}
                      className="py-2 px-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs shadow"
                    >
                      {evaluatingId === key ? 'Evaluating Answer...' : 'Submit Response to Examiner'}
                    </button>

                    {evaluation && (
                      <div className="p-4 bg-cyan-950/40 border border-cyan-800 rounded-xl space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-cyan-300">Examiner Score: {evaluation.score}/100</span>
                          <span className="font-bold text-emerald-400">{evaluation.grade}</span>
                        </div>
                        <p className="text-slate-300">{evaluation.feedback}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
