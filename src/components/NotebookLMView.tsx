import React, { useState } from 'react';
import {
  FileText,
  Upload,
  Plus,
  Trash2,
  Sparkles,
  BookOpen,
  Search,
  Check,
  FileCode,
  FileUp,
  ExternalLink,
  MessageSquare,
  AlertCircle,
  X,
  Layers,
  Layers3,
  Bookmark,
  StickyNote,
  Send
} from 'lucide-react';
import { SourceDocument } from '../types';
import { uploadDocument, synthesizeMultiDocuments } from '../services/api';

interface NotebookLMViewProps {
  sources: SourceDocument[];
  onAddSource: (source: SourceDocument) => void;
  onDeleteSource: (id: string) => void;
  onAskSource: (sourceTitle: string) => void;
}

export const NotebookLMView: React.FC<NotebookLMViewProps> = ({
  sources,
  onAddSource,
  onDeleteSource,
  onAskSource,
}) => {
  const [activeTab, setActiveTab] = useState<'sources' | 'upload' | 'synthesis'>('sources');
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<SourceDocument | null>(null);

  // Multi-doc synthesis state
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [synthesisQuery, setSynthesisQuery] = useState('');
  const [synthesisResult, setSynthesisResult] = useState<{ synthesisAnswer: string; sourcesAnalyzed: string[] } | null>(null);
  const [synthesisLoading, setSynthesisLoading] = useState(false);

  // Document Annotation state
  const [annotations, setAnnotations] = useState<Record<string, string[]>>({});
  const [newAnnotation, setNewAnnotation] = useState('');

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && !pastedText.trim()) {
      setError('Please select a file or paste study text.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await uploadDocument(file, pastedText, title || file?.name || 'Study Document');
      
      const newDoc: SourceDocument = {
        id: `src-${Date.now()}`,
        notebookId: 'nb-1',
        title: res.document.title || title || 'Uploaded Document',
        type: res.document.type as any || 'text',
        content: res.document.content || pastedText || '',
        fileSize: file ? `${(file.size / 1024).toFixed(0)} KB` : 'Pasted Text',
        addedAt: new Date().toISOString().split('T')[0],
        summary: res.document.summary,
        keyConcepts: res.document.keyConcepts || [],
        citationCount: 0,
      };

      onAddSource(newDoc);
      setFile(null);
      setPastedText('');
      setTitle('');
      setActiveTab('sources');
    } catch (err: any) {
      setError(err?.message || 'Failed to upload and analyze document');
    } finally {
      setLoading(false);
    }
  };

  const toggleDocSelection = (id: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSynthesize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDocIds.length === 0) {
      setError('Select at least one document to run multi-document synthesis.');
      return;
    }
    if (!synthesisQuery.trim()) return;

    setSynthesisLoading(true);
    setError('');

    const targetDocs = sources
      .filter((s) => selectedDocIds.includes(s.id))
      .map((s) => ({ title: s.title, content: s.content }));

    try {
      const res = await synthesizeMultiDocuments(targetDocs, synthesisQuery);
      setSynthesisResult(res);
    } catch (err: any) {
      setError('Failed to run multi-document synthesis query.');
    } finally {
      setSynthesisLoading(false);
    }
  };

  const handleAddAnnotation = (docId: string) => {
    if (!newAnnotation.trim()) return;
    setAnnotations((prev) => ({
      ...prev,
      [docId]: [...(prev[docId] || []), newAnnotation.trim()],
    }));
    setNewAnnotation('');
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600 dark:text-indigo-400" /> Grounded Sources & Synthesis (NotebookLM)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Upload PDFs, DOCX, PPT, handwritten notes/OCR to query across multiple documents with citations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('sources')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'sources'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            All Sources ({sources.length})
          </button>
          <button
            onClick={() => setActiveTab('synthesis')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'synthesis'
                ? 'bg-purple-600 text-white shadow'
                : 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 hover:bg-purple-100'
            }`}
          >
            <Layers3 className="w-4 h-4" /> Multi-Doc Synthesis
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100'
            }`}
          >
            <Plus className="w-4 h-4" /> Add Source
          </button>
        </div>
      </div>

      {/* Main Content Areas */}
      {activeTab === 'upload' ? (
        <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-md">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
            <FileUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Upload Study Material & Handwritten Notes
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
            Gemini 3.6 Flash will parse text, perform OCR on images/handwritten notes, and extract source briefings.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleUploadSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Document Title (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Lecture 4 - Computer Networks.pdf"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* File Dropzone */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Attach File (PDF, DOCX, PPT, Images/OCR, MD, TXT)
              </label>
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 rounded-2xl p-6 text-center bg-slate-50/50 dark:bg-slate-800/40 transition-colors cursor-pointer relative">
                <input
                  type="file"
                  accept=".pdf,.docx,.ppt,.pptx,.txt,.md,.png,.jpg,.jpeg,.zip"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <Upload className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {file ? file.name : 'Click or drag file here'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Supports PDF, Word (DOCX), PowerPoint (PPT), Images/Handwritten (OCR), Markdown, Text
                </p>
              </div>
            </div>

            <div className="text-center text-xs text-slate-400 font-medium">OR</div>

            {/* Pasted Text */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Paste Raw Text / Lecture Notes
              </label>
              <textarea
                placeholder="Paste article, transcript, or lecture notes here..."
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 text-xs text-slate-900 dark:text-slate-100 h-32 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('sources')}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin" /> Analyzing Document...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Analyze & Save Source
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      ) : activeTab === 'synthesis' ? (
        /* Multi-Doc Synthesis Tab */
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Layers3 className="w-5 h-5 text-purple-600 dark:text-purple-400" /> Multi-Document Cross-Synthesis Query
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select 2 or more sources below to ask 1 question and get an AI answer synthesized across all selected documents with precise citations.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {sources.map((src) => {
                const isSelected = selectedDocIds.includes(src.id);
                return (
                  <div
                    key={src.id}
                    onClick={() => toggleDocSelection(src.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-purple-50 dark:bg-purple-950/50 border-purple-500 text-purple-900 dark:text-purple-200 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className={`w-4 h-4 ${isSelected ? 'text-purple-600' : 'text-slate-400'}`} />
                      <span className="text-xs font-semibold truncate">{src.title}</span>
                    </div>
                    <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${isSelected ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300 dark:border-slate-700'}`}>
                      {isSelected && <Check className="w-3 h-3" />}
                    </div>
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleSynthesize} className="flex gap-2 pt-2">
              <input
                type="text"
                value={synthesisQuery}
                onChange={(e) => setSynthesisQuery(e.target.value)}
                placeholder="e.g. Compare the main arguments across these selected papers..."
                className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                type="submit"
                disabled={synthesisLoading}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs rounded-xl shadow flex items-center gap-2 shrink-0"
              >
                {synthesisLoading ? <Sparkles className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Synthesize Answer
              </button>
            </form>
          </div>

          {synthesisResult && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                  Cross-Document Synthesis Result
                </span>
                <span className="text-[11px] text-slate-400">
                  Sources Analyzed: {synthesisResult.sourcesAnalyzed?.join(', ')}
                </span>
              </div>
              <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                {synthesisResult.synthesisAnswer}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Sources Grid */
        <div className="space-y-4">
          {sources.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <FileText className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No sources added yet</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
                Upload PDFs or study notes to enable NotebookLM source grounding.
              </p>
              <button
                onClick={() => setActiveTab('upload')}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold shadow"
              >
                Add Your First Source
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sources.map((src) => (
                <div
                  key={src.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-indigo-500/40 transition-all flex flex-col justify-between shadow-xs"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 tracking-tight line-clamp-1">
                            {src.title}
                          </h3>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span className="uppercase font-semibold text-indigo-500">{src.type}</span>
                            <span>•</span>
                            <span>{src.fileSize || 'Text'}</span>
                            <span>•</span>
                            <span>Added {src.addedAt}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => onDeleteSource(src.id)}
                        className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Delete Source"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Source Briefing */}
                    {src.summary && (
                      <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 mb-3 border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block mb-1">
                          Source Briefing
                        </span>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
                          {src.summary}
                        </p>
                      </div>
                    )}

                    {/* Key Concepts */}
                    {src.keyConcepts && src.keyConcepts.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {src.keyConcepts.map((concept, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700"
                          >
                            {concept}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/80 mt-2">
                    <button
                      onClick={() => setSelectedDoc(src)}
                      className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Read Content & Annotate
                    </button>

                    <button
                      onClick={() => onAskSource(src.title)}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Ask Questions
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Full Document Reader & Annotation Drawer Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex justify-end">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 h-full p-6 overflow-y-auto border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">{selectedDoc.title}</h3>
                </div>
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {selectedDoc.summary && (
                <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
                  <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-300 uppercase mb-1">
                    AI Source Briefing
                  </h4>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{selectedDoc.summary}</p>
                </div>
              )}

              {/* Sticky Annotations Section */}
              <div className="bg-amber-50/60 dark:bg-amber-950/30 p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <StickyNote className="w-3.5 h-3.5" /> Sticky Annotations & Highlights
                  </h5>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400">
                    {annotations[selectedDoc.id]?.length || 0} Notes
                  </span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newAnnotation}
                    onChange={(e) => setNewAnnotation(e.target.value)}
                    placeholder="Add a sticky note or key reminder..."
                    className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800/60 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                  <button
                    onClick={() => handleAddAnnotation(selectedDoc.id)}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold"
                  >
                    Add
                  </button>
                </div>

                {annotations[selectedDoc.id] && annotations[selectedDoc.id].length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {annotations[selectedDoc.id].map((note, idx) => (
                      <div key={idx} className="p-2 bg-white dark:bg-slate-900 rounded-lg text-xs text-slate-700 dark:text-slate-300 border border-amber-200/80 dark:border-amber-800/40">
                        • {note}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Raw Document Content</h4>
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                {selectedDoc.content}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedDoc(null)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-xl"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
