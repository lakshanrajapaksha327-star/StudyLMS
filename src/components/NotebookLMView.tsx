import React, { useState, useEffect } from 'react';
import {
  FileText,
  Upload,
  Plus,
  Trash2,
  Sparkles,
  Search,
  Check,
  FileUp,
  ExternalLink,
  MessageSquare,
  AlertCircle,
  X,
  Layers3,
  StickyNote,
  Send,
  Download,
  RefreshCw,
  Edit3,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Image as ImageIcon,
  CheckSquare,
  Square,
  BookOpen,
} from 'lucide-react';
import { DocumentAnnotation, DocumentCitation, NoteItem, SourceDocument } from '../types';
import {
  uploadDocument,
  synthesizeMultiDocuments,
  renameDocumentApi,
  replaceDocumentFileApi,
  reindexDocumentApi,
  fetchDocumentContentApi,
  searchInsideDocumentApi,
  downloadOriginalDocumentApi,
  recordDocumentAccess,
  fetchAnnotationsApi,
  saveAnnotationApi,
  deleteAnnotationApi,
  generateSummaryModeApi,
} from '../services/api';

interface NotebookLMViewProps {
  sources: SourceDocument[];
  activeNotebookId: string;
  onAddSource: (source: SourceDocument) => void;
  onUpdateSource?: (source: SourceDocument) => void;
  onDeleteSource: (id: string) => void;
  onAskSource: (sourceTitle: string) => void;
  onSaveNote?: (note: NoteItem, saveVersion?: boolean) => void;
  focusedCitation?: DocumentCitation | null;
  onClearFocusedCitation?: () => void;
  isAuthenticated?: boolean;
}

export const NotebookLMView: React.FC<NotebookLMViewProps> = ({
  sources,
  activeNotebookId,
  onAddSource,
  onUpdateSource,
  onDeleteSource,
  onAskSource,
  onSaveNote,
  focusedCitation,
  onClearFocusedCitation,
  isAuthenticated = false,
}) => {
  const [activeTab, setActiveTab] = useState<'sources' | 'upload' | 'synthesis'>('sources');
  const [libraryFilter, setLibraryFilter] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [error, setError] = useState('');

  // Reader modal state
  const [selectedDoc, setSelectedDoc] = useState<SourceDocument | null>(null);
  const [docChunks, setDocChunks] = useState<
    Array<{ id: string; chunkIndex: number; pageNumber?: number; slideNumber?: number; sectionHeading?: string; content: string }>
  >([]);
  const [docFullText, setDocFullText] = useState('');
  const [loadingDocContent, setLoadingDocContent] = useState(false);
  const [insideSearchQuery, setInsideSearchQuery] = useState('');
  const [insideSearchMatches, setInsideSearchMatches] = useState<any[] | null>(null);
  const [highlightedChunkIndex, setHighlightedChunkIndex] = useState<number | null>(null);
  const [docAiLoading, setDocAiLoading] = useState(false);
  const [docAiOutput, setDocAiOutput] = useState<{ title: string; markdown: string } | null>(null);

  // Rename / Replace state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [reindexingId, setReindexingId] = useState<string | null>(null);

  // Multi-doc selection & bulk actions state
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [synthesisMode, setSynthesisMode] = useState<'synthesis' | 'compare' | 'conflicts' | 'definitions' | 'timeline'>('synthesis');
  const [synthesisQuery, setSynthesisQuery] = useState('');
  const [synthesisResult, setSynthesisResult] = useState<{
    synthesisAnswer: string;
    sourcesAnalyzed: string[];
    citations?: DocumentCitation[];
  } | null>(null);
  const [synthesisLoading, setSynthesisLoading] = useState(false);

  // Persisted Document Annotation state
  const [annotationsByDoc, setAnnotationsByDoc] = useState<Record<string, DocumentAnnotation[]>>({});
  const [newAnnotation, setNewAnnotation] = useState('');
  const [savingAnnotation, setSavingAnnotation] = useState(false);

  useEffect(() => {
    if (focusedCitation) {
      const target = sources.find((s) => s.id === focusedCitation.documentId)
        || sources.find((s) => s.title === focusedCitation.documentTitle);
      if (target) {
        openDocumentReader(target, focusedCitation.chunkIndex ?? null);
      }
      onClearFocusedCitation?.();
    }
  }, [focusedCitation]);

  const openDocumentReader = async (doc: SourceDocument, focusChunkIdx: number | null = null) => {
    setSelectedDoc(doc);
    setDocFullText(doc.content);
    setDocChunks([]);
    setInsideSearchQuery('');
    setInsideSearchMatches(null);
    setHighlightedChunkIndex(focusChunkIdx);
    setDocAiOutput(null);

    if (isAuthenticated) {
      setLoadingDocContent(true);
      recordDocumentAccess(doc.id, doc.title, doc.type).catch(() => {});
      fetchAnnotationsApi(doc.id)
        .then((list) => {
          setAnnotationsByDoc((prev) => ({ ...prev, [doc.id]: list }));
        })
        .catch(() => {});
      try {
        const res = await fetchDocumentContentApi(doc.id);
        if (res.fullText) setDocFullText(res.fullText);
        if (Array.isArray(res.chunks)) setDocChunks(res.chunks);
      } catch {
        // fallback to doc.content already set
      } finally {
        setLoadingDocContent(false);
      }
    }
  };

  const handleInsideSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc || !insideSearchQuery.trim()) {
      setInsideSearchMatches(null);
      return;
    }
    if (isAuthenticated) {
      try {
        const matches = await searchInsideDocumentApi(selectedDoc.id, insideSearchQuery.trim());
        setInsideSearchMatches(matches);
        return;
      } catch {
        // fall through to local search
      }
    }
    const q = insideSearchQuery.trim().toLowerCase();
    const lines = docFullText.split('\n').filter((l) => l.toLowerCase().includes(q));
    setInsideSearchMatches(lines.map((line, i) => ({ chunkIndex: i, excerpt: line })));
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0 && !pastedText.trim()) {
      setError('Please select one or more files or paste study text.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          setUploadProgressText(`Extracting, OCR scanning & indexing (${i + 1}/${files.length}): ${f.name}...`);
          const docTitle = files.length === 1 && title.trim() ? title.trim() : f.name;
          const res = await uploadDocument(f, '', docTitle, activeNotebookId);
          onAddSource(res.document);
        }
      } else {
        setUploadProgressText('Chunking & indexing pasted study text...');
        const res = await uploadDocument(null, pastedText, title.trim() || 'Pasted Study Notes', activeNotebookId);
        onAddSource(res.document);
      }

      setFiles([]);
      setPastedText('');
      setTitle('');
      setUploadProgressText('');
      setActiveTab('sources');
    } catch (err: any) {
      setError(err?.message || 'Failed to upload and index document.');
    } finally {
      setLoading(false);
      setUploadProgressText('');
    }
  };

  const handleRenameSubmit = async (docId: string) => {
    if (!renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    try {
      if (isAuthenticated) {
        const updated = await renameDocumentApi(docId, renameValue.trim());
        onUpdateSource?.(updated);
      } else {
        const existing = sources.find((s) => s.id === docId);
        if (existing) onUpdateSource?.({ ...existing, title: renameValue.trim() });
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to rename document.');
    } finally {
      setRenamingId(null);
    }
  };

  const handleReindex = async (docId: string) => {
    setReindexingId(docId);
    setError('');
    try {
      const res = await reindexDocumentApi(docId);
      if (res.document) onUpdateSource?.(res.document);
    } catch (err: any) {
      setError(err?.message || 'Failed to re-index document.');
    } finally {
      setReindexingId(null);
    }
  };

  const handleReplaceFile = async (docId: string, fileList: FileList | null) => {
    const newFile = fileList?.[0];
    if (!newFile) return;
    setReindexingId(docId);
    setError('');
    try {
      const res = await replaceDocumentFileApi(docId, newFile);
      if (res.document) onUpdateSource?.(res.document);
    } catch (err: any) {
      setError(err?.message || 'Failed to replace document file.');
    } finally {
      setReindexingId(null);
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
      setError('Select at least one document to run cross-document analysis.');
      return;
    }
    if (!synthesisQuery.trim()) return;

    setSynthesisLoading(true);
    setError('');

    const targetDocs = sources
      .filter((s) => selectedDocIds.includes(s.id))
      .map((s) => ({ id: s.id, title: s.title, content: s.content }));

    try {
      const res = await synthesizeMultiDocuments(
        targetDocs,
        synthesisQuery,
        synthesisMode,
        activeNotebookId
      );
      setSynthesisResult(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to run multi-document synthesis query.');
    } finally {
      setSynthesisLoading(false);
    }
  };

  const handleAddAnnotation = async (docId: string) => {
    if (!newAnnotation.trim() || savingAnnotation) return;
    const text = newAnnotation.trim();
    setSavingAnnotation(true);
    try {
      if (isAuthenticated) {
        const saved = await saveAnnotationApi({
          documentId: docId,
          notebookId: activeNotebookId,
          content: text,
          type: 'sticky_note',
          pageNumber: 1,
        });
        setAnnotationsByDoc((prev) => ({
          ...prev,
          [docId]: [saved, ...(prev[docId] || [])],
        }));
      } else {
        const localItem: DocumentAnnotation = {
          id: `annot-${Date.now()}`,
          documentId: docId,
          notebookId: activeNotebookId,
          content: text,
          type: 'sticky_note',
          createdAt: new Date().toISOString(),
        };
        setAnnotationsByDoc((prev) => ({
          ...prev,
          [docId]: [localItem, ...(prev[docId] || [])],
        }));
      }
      setNewAnnotation('');
    } catch (err: any) {
      setError(err?.message || 'Failed to save annotation.');
    } finally {
      setSavingAnnotation(false);
    }
  };

  const handleDeleteAnnotation = async (docId: string, annotationId: string) => {
    setAnnotationsByDoc((prev) => ({
      ...prev,
      [docId]: (prev[docId] || []).filter((a) => a.id !== annotationId),
    }));
    if (isAuthenticated) {
      await deleteAnnotationApi(annotationId).catch(() => {});
    }
  };

  const handleRunDocAiTool = async (
    doc: SourceDocument,
    mode: 'detailed' | 'key_points' | 'definitions' | 'exam_focused'
  ) => {
    setDocAiLoading(true);
    setError('');
    try {
      const res = await generateSummaryModeApi({
        mode,
        title: doc.title,
        sourceContent: doc.content,
        notebookId: activeNotebookId,
        selectedDocumentIds: [doc.id],
      });
      setDocAiOutput({
        title: res.summary?.title || `${doc.title} (${mode})`,
        markdown: res.summary?.contentMarkdown || '',
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to analyze document.');
    } finally {
      setDocAiLoading(false);
    }
  };

  const handleSaveDocAiToNotes = (titleStr: string, markdown: string) => {
    if (!onSaveNote || !markdown.trim()) return;
    onSaveNote(
      {
        id: `note-${Date.now()}`,
        notebookId: activeNotebookId,
        title: titleStr,
        content: markdown,
        updatedAt: new Date().toISOString(),
        tags: ['Document Insight'],
        aiGenerated: true,
      },
      true
    );
  };

  const handleBulkDeleteSelected = async () => {
    if (selectedDocIds.length === 0) return;
    setBulkBusy(true);
    try {
      for (const id of selectedDocIds) {
        await Promise.resolve(onDeleteSource(id));
      }
      setSelectedDocIds([]);
      setConfirmBulkDelete(false);
    } finally {
      setBulkBusy(false);
    }
  };

  const filteredSources = libraryFilter.trim()
    ? sources.filter(
        (s) =>
          s.title.toLowerCase().includes(libraryFilter.toLowerCase()) ||
          (s.summary || '').toLowerCase().includes(libraryFilter.toLowerCase())
      )
    : sources;

  const allFilteredSelected =
    filteredSources.length > 0 && filteredSources.every((s) => selectedDocIds.includes(s.id));

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      const filteredIds = new Set(filteredSources.map((s) => s.id));
      setSelectedDocIds((prev) => prev.filter((id) => !filteredIds.has(id)));
    } else {
      const merged = new Set([...selectedDocIds, ...filteredSources.map((s) => s.id)]);
      setSelectedDocIds(Array.from(merged));
    }
  };

  const getStatusBadge = (doc: SourceDocument) => {
    const status = doc.processingStatus || 'ready';
    if (status === 'ready') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3 h-3" /> Indexed ({doc.chunkCount || 1} chunks)
        </span>
      );
    }
    if (status === 'partially_processed') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <AlertTriangle className="w-3 h-3" /> Partial OCR
        </span>
      );
    }
    if (status === 'failed') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          <AlertCircle className="w-3 h-3" /> Failed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-500">
        {status} ({doc.progressPercent ?? 50}%)
      </span>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600 dark:text-indigo-400" /> Grounded Document Library (RAG)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Upload PDFs, Word (DOCX), PowerPoint (PPTX), Excel (XLSX), CSV, Markdown, TXT, or handwritten images for OCR, chunking & semantic citations.
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
            <Layers3 className="w-4 h-4" /> Multi-Doc Analysis
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100'
            }`}
          >
            <Plus className="w-4 h-4" /> Add Sources
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-xl flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="p-1 hover:opacity-70">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {activeTab === 'upload' ? (
        <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-md">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
            <FileUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Upload Multi-Format Study Materials
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
            Documents are validated by magic bytes, parsed page/slide-by-page (with Gemini Vision OCR for scanned PDFs & handwritten notes), chunked, and embedded for RAG retrieval.
          </p>

          <form onSubmit={handleUploadSubmit} className="space-y-5">
            {files.length <= 1 && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Document Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lecture 4 - Neural Networks.pdf"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Attach Files (Multiple Supported — PDF, DOCX, PPTX, XLSX, CSV, MD, TXT, PNG/JPG/WEBP)
              </label>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files?.length) {
                    setFiles(Array.from(e.dataTransfer.files));
                  }
                }}
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-colors cursor-pointer relative ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-slate-300 dark:border-slate-700 hover:border-indigo-500 bg-slate-50/50 dark:bg-slate-800/40'
                }`}
              >
                <input
                  type="file"
                  multiple
                  accept=".pdf,.docx,.pptx,.xlsx,.csv,.txt,.md,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => setFiles(Array.from(e.target.files || []))}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <Upload className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {files.length > 0
                    ? `${files.length} file(s) selected: ${files.map((f) => f.name).join(', ')}`
                    : 'Click or drag & drop up to 10 study files here'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Max 25 MB per file • Scanned PDFs & handwritten photos trigger automatic OCR
                </p>
              </div>
            </div>

            <div className="text-center text-xs text-slate-400 font-medium">OR</div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Paste Raw Lecture Notes / Transcript
              </label>
              <textarea
                placeholder="Paste article, transcript, or lecture notes here..."
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 text-xs text-slate-900 dark:text-slate-100 h-32 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            {uploadProgressText && (
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4 animate-spin shrink-0" />
                <span>{uploadProgressText}</span>
              </div>
            )}

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
                    <Sparkles className="w-4 h-4 animate-spin" /> Processing & Embedding...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Extract, Embed & Save
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      ) : activeTab === 'synthesis' ? (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Layers3 className="w-5 h-5 text-purple-600 dark:text-purple-400" /> Multi-Document Grounded Analysis
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Select multiple sources and choose an analysis mode. Every claim is grounded in vector-retrieved chunks with citations.
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: 'synthesis', label: 'Synthesize' },
                    { id: 'compare', label: 'Compare Docs' },
                    { id: 'conflicts', label: 'Find Conflicts' },
                    { id: 'definitions', label: 'Definitions' },
                    { id: 'timeline', label: 'Timeline' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSynthesisMode(m.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                      synthesisMode === m.id
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

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
                      <FileText className={`w-4 h-4 shrink-0 ${isSelected ? 'text-purple-600' : 'text-slate-400'}`} />
                      <span className="text-xs font-semibold truncate">{src.title}</span>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-purple-600 border-purple-600 text-white'
                          : 'border-slate-300 dark:border-slate-700'
                      }`}
                    >
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
                placeholder="Ask a question across your selected documents..."
                className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                type="submit"
                disabled={synthesisLoading}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs rounded-xl shadow flex items-center gap-2 shrink-0"
              >
                {synthesisLoading ? <Sparkles className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Run Grounded Analysis
              </button>
            </form>
          </div>

          {synthesisResult && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                  Cross-Document {synthesisMode} Result
                </span>
                <span className="text-[11px] text-slate-400">
                  Analyzed: {synthesisResult.sourcesAnalyzed?.join(', ')}
                </span>
              </div>
              <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                {synthesisResult.synthesisAnswer}
              </div>

              {synthesisResult.citations && synthesisResult.citations.length > 0 && (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Grounded Citations (Click to inspect source)
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {synthesisResult.citations.map((c, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          const target = sources.find((s) => s.id === c.documentId)
                            || sources.find((s) => s.title === c.documentTitle);
                          if (target) openDocumentReader(target, c.chunkIndex ?? null);
                        }}
                        className="text-[11px] bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 text-purple-700 dark:text-purple-300 px-2.5 py-1 rounded-lg border border-purple-200 dark:border-purple-800 text-left"
                      >
                        [{c.documentTitle}
                        {c.pageNumber ? ` • Page ${c.pageNumber}` : ''}
                        {c.slideNumber ? ` • Slide ${c.slideNumber}` : ''}]
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {sources.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3">
              <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                <button
                  type="button"
                  onClick={toggleSelectAllFiltered}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-300 shrink-0"
                >
                  {allFilteredSelected ? (
                    <CheckSquare className="w-3.5 h-3.5 text-indigo-500" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <span>{allFilteredSelected ? 'Deselect All' : 'Select All'}</span>
                </button>
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={libraryFilter}
                    onChange={(e) => setLibraryFilter(e.target.value)}
                    placeholder="Filter library documents..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
              </div>

              {selectedDocIds.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-indigo-500">
                    {selectedDocIds.length} selected
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSynthesisMode('compare');
                      setActiveTab('synthesis');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
                  >
                    Compare / Synthesize
                  </button>
                  {confirmBulkDelete ? (
                    <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/30 px-2.5 py-1 rounded-xl">
                      <span className="text-[11px] text-rose-500 font-semibold">
                        Delete {selectedDocIds.length}?
                      </span>
                      <button
                        type="button"
                        disabled={bulkBusy}
                        onClick={handleBulkDeleteSelected}
                        className="px-2 py-0.5 rounded bg-rose-600 text-white text-[11px] font-bold"
                      >
                        {bulkBusy ? 'Removing...' : 'Confirm'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmBulkDelete(false)}
                        className="px-2 py-0.5 text-[11px] text-slate-400 hover:text-slate-200"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmBulkDelete(true)}
                      className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 text-xs font-semibold flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove Selected
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {sources.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <FileText className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No sources in this notebook yet</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
                Upload PDFs, Word docs, slides, spreadsheets, or handwritten notes to index them for grounded AI chat & quizzes.
              </p>
              <button
                onClick={() => setActiveTab('upload')}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold shadow"
              >
                Upload Study Documents
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredSources.map((src) => {
                const isChecked = selectedDocIds.includes(src.id);
                return (
                <div
                  key={src.id}
                  className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 transition-all flex flex-col justify-between shadow-xs ${
                    isChecked
                      ? 'border-indigo-500 ring-1 ring-indigo-500/30'
                      : 'border-slate-200 dark:border-slate-800 hover:border-indigo-500/40'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => toggleDocSelection(src.id)}
                          className="text-slate-400 hover:text-indigo-500 shrink-0"
                          title="Select document"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-indigo-500" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                          {src.type === 'image' ? (
                            <ImageIcon className="w-4 h-4" />
                          ) : src.type === 'xlsx' || src.type === 'csv' ? (
                            <FileSpreadsheet className="w-4 h-4" />
                          ) : (
                            <FileText className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          {renamingId === src.id ? (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                handleRenameSubmit(src.id);
                              }}
                              className="flex gap-1"
                            >
                              <input
                                type="text"
                                autoFocus
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                className="flex-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-xs font-bold"
                              />
                              <button
                                type="submit"
                                className="px-2 py-1 bg-indigo-600 text-white rounded text-[10px] font-bold"
                              >
                                Save
                              </button>
                            </form>
                          ) : (
                            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 tracking-tight truncate">
                              {src.title}
                            </h3>
                          )}
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            <span className="uppercase font-semibold text-indigo-500">{src.type}</span>
                            <span>•</span>
                            <span>{src.fileSize || 'Text'}</span>
                            {src.pageCount ? (
                              <>
                                <span>•</span>
                                <span>{src.pageCount} pages/slides</span>
                              </>
                            ) : null}
                            <span>•</span>
                            {getStatusBadge(src)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            setRenamingId(src.id);
                            setRenameValue(src.title);
                          }}
                          className="text-slate-400 hover:text-indigo-500 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Rename Document"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {isAuthenticated && (
                          <button
                            onClick={() => handleReindex(src.id)}
                            disabled={reindexingId === src.id}
                            className="text-slate-400 hover:text-amber-500 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Re-index / Retry Embeddings"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${reindexingId === src.id ? 'animate-spin' : ''}`} />
                          </button>
                        )}
                        <button
                          onClick={() => onDeleteSource(src.id)}
                          className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Delete Source"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {src.ocrWarnings && (
                      <div className="mb-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-600 dark:text-amber-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{src.ocrWarnings}</span>
                      </div>
                    )}

                    {src.errorMessage && (
                      <div className="mb-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-500">
                        {src.errorMessage}
                      </div>
                    )}

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

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80 mt-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openDocumentReader(src)}
                        className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Read & Search
                      </button>

                      {isAuthenticated && src.storageRef && (
                        <button
                          onClick={() =>
                            downloadOriginalDocumentApi(src.id, src.originalFilename || src.title)
                          }
                          className="text-xs font-semibold text-slate-500 hover:text-emerald-500 flex items-center gap-1"
                          title="Download original file"
                        >
                          <Download className="w-3.5 h-3.5" /> Original
                        </button>
                      )}

                      {isAuthenticated && (
                        <label className="text-xs font-semibold text-slate-500 hover:text-indigo-500 cursor-pointer flex items-center gap-1">
                          <Upload className="w-3.5 h-3.5" /> Replace
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.docx,.pptx,.xlsx,.csv,.txt,.md,.png,.jpg,.jpeg,.webp"
                            onChange={(e) => handleReplaceFile(src.id, e.target.files)}
                          />
                        </label>
                      )}
                    </div>

                    <button
                      onClick={() => onAskSource(src.title)}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Ask Tutor
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Full Document Reader, Chunk Search & Annotation Drawer */}
      {selectedDoc && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex justify-end">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 h-full p-6 overflow-y-auto border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 truncate">
                    {selectedDoc.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search Inside Document */}
              <form onSubmit={handleInsideSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={insideSearchQuery}
                    onChange={(e) => setInsideSearchQuery(e.target.value)}
                    placeholder="Search inside this document..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold"
                >
                  Find
                </button>
              </form>

              {insideSearchMatches && (
                <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-indigo-600 dark:text-indigo-300">
                    <span>{insideSearchMatches.length} matching passage(s)</span>
                    <button onClick={() => setInsideSearchMatches(null)} className="underline">
                      Clear
                    </button>
                  </div>
                  {insideSearchMatches.map((m, idx) => (
                    <button
                      key={idx}
                      onClick={() => setHighlightedChunkIndex(m.chunkIndex)}
                      className="w-full text-left p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs hover:border-indigo-500"
                    >
                      <span className="font-bold text-indigo-500 mr-1.5">
                        {m.pageNumber ? `Page ${m.pageNumber}` : m.slideNumber ? `Slide ${m.slideNumber}` : `Match ${idx + 1}`}:
                      </span>
                      <span className="text-slate-700 dark:text-slate-300">{m.excerpt}</span>
                    </button>
                  ))}
                </div>
              )}

              {selectedDoc.summary && (
                <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
                  <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-300 uppercase mb-1">
                    AI Source Briefing
                  </h4>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {selectedDoc.summary}
                  </p>
                </div>
              )}

              {/* Quick Document AI Tools */}
              <div className="p-3.5 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/70 dark:border-indigo-800/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" /> Quick Source AI Actions
                  </span>
                  {docAiLoading && <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-spin" />}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={docAiLoading}
                    onClick={() => handleRunDocAiTool(selectedDoc, 'detailed')}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold hover:border-indigo-500"
                  >
                    Generate Summary
                  </button>
                  <button
                    type="button"
                    disabled={docAiLoading}
                    onClick={() => handleRunDocAiTool(selectedDoc, 'key_points')}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold hover:border-indigo-500"
                  >
                    Key Concepts
                  </button>
                  <button
                    type="button"
                    disabled={docAiLoading}
                    onClick={() => handleRunDocAiTool(selectedDoc, 'definitions')}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold hover:border-indigo-500"
                  >
                    Definitions
                  </button>
                  <button
                    type="button"
                    disabled={docAiLoading}
                    onClick={() => handleRunDocAiTool(selectedDoc, 'exam_focused')}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold hover:border-indigo-500"
                  >
                    Study Guide
                  </button>
                </div>

                {docAiOutput && (
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {docAiOutput.title}
                      </span>
                      {onSaveNote && (
                        <button
                          type="button"
                          onClick={() => handleSaveDocAiToNotes(docAiOutput.title, docAiOutput.markdown)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold"
                        >
                          Save to Notes
                        </button>
                      )}
                    </div>
                    <div className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-52 overflow-y-auto">
                      {docAiOutput.markdown}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-amber-50/60 dark:bg-amber-950/30 p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <StickyNote className="w-3.5 h-3.5" /> Sticky Notes & Annotations
                  </h5>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400">
                    {(annotationsByDoc[selectedDoc.id] || []).length} Notes
                  </span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newAnnotation}
                    onChange={(e) => setNewAnnotation(e.target.value)}
                    placeholder="Add a persistent sticky note..."
                    className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800/60 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={savingAnnotation}
                    onClick={() => handleAddAnnotation(selectedDoc.id)}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                  >
                    {savingAnnotation ? 'Saving...' : 'Add'}
                  </button>
                </div>

                {(annotationsByDoc[selectedDoc.id] || []).length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {(annotationsByDoc[selectedDoc.id] || []).map((annot) => (
                      <div
                        key={annot.id}
                        className="p-2 bg-white dark:bg-slate-900 rounded-lg text-xs text-slate-700 dark:text-slate-300 border border-amber-200/80 dark:border-amber-800/40 flex items-center justify-between gap-2"
                      >
                        <span>• {annot.content}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteAnnotation(selectedDoc.id, annot.id)}
                          className="text-slate-400 hover:text-rose-500 shrink-0"
                          title="Delete annotation"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {loadingDocContent ? 'Loading Indexed Chunks...' : docChunks.length > 0 ? `Indexed Chunks (${docChunks.length})` : 'Extracted Document Content'}
              </h4>

              {docChunks.length > 0 ? (
                <div className="space-y-3">
                  {docChunks.map((ch) => (
                    <div
                      key={ch.id}
                      className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                        highlightedChunkIndex === ch.chunkIndex
                          ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/30'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="text-[10px] font-bold text-indigo-500 uppercase mb-1 flex items-center gap-2">
                        <span>Chunk #{ch.chunkIndex + 1}</span>
                        {ch.pageNumber && <span>• Page {ch.pageNumber}</span>}
                        {ch.slideNumber && <span>• Slide {ch.slideNumber}</span>}
                        {ch.sectionHeading && <span>• {ch.sectionHeading}</span>}
                      </div>
                      <div className="font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                        {ch.content}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {docFullText}
                </div>
              )}
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
