import React, { useCallback, useEffect, useState } from 'react';
import {
  Mic,
  Upload,
  Sparkles,
  FileAudio,
  Layers,
  HelpCircle,
  BookOpen,
  Trash2,
  Info,
  CheckCircle2,
} from 'lucide-react';
import {
  deleteAudioLectureApi,
  fetchAudioLecturesApi,
  uploadAudioLectureApi,
} from '../services/api';
import { AudioLectureItem, FlashcardSet, NoteItem, QuizSet } from '../types';

interface AudioLectureViewProps {
  activeNotebookId?: string;
  onAddFlashcardSet?: (set: FlashcardSet) => void;
  onAddQuizSet?: (quiz: QuizSet) => void;
  onSaveNote?: (note: NoteItem, saveVersion?: boolean) => Promise<void> | void;
  onToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
const ACCEPTED_EXT = ['mp3', 'wav', 'webm', 'm4a', 'ogg', 'flac'];

export const AudioLectureView: React.FC<AudioLectureViewProps> = ({
  activeNotebookId,
  onAddFlashcardSet,
  onAddQuizSet,
  onSaveNote,
  onToast,
}) => {
  const [lectures, setLectures] = useState<AudioLectureItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [savedNotice, setSavedNotice] = useState('');

  const loadLectures = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await fetchAudioLecturesApi(activeNotebookId);
      setLectures(list);
      if (list.length > 0) {
        setActiveId((prev) => (prev && list.some((l) => l.id === prev) ? prev : list[0].id));
      } else {
        setActiveId(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load audio lectures.');
    } finally {
      setLoading(false);
    }
  }, [activeNotebookId]);

  useEffect(() => {
    loadLectures();
  }, [loadLectures]);

  const activeLecture = lectures.find((l) => l.id === activeId) || lectures[0] || null;

  const validateAndStageFile = (file: File) => {
    setError('');
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!file.type.startsWith('audio/') && !ACCEPTED_EXT.includes(ext)) {
      setError('Unsupported file type. Please upload MP3, WAV, WebM, M4A, OGG, or FLAC audio.');
      return;
    }
    if (file.size === 0) {
      setError('Uploaded audio file is empty.');
      return;
    }
    if (file.size > MAX_AUDIO_BYTES) {
      setError('Audio file exceeds the 15MB upload cap.');
      return;
    }
    setSelectedFile(file);
    if (!titleInput.trim()) {
      setTitleInput(file.name.replace(/\.[^.]+$/, ''));
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    setUploading(true);
    setError('');
    try {
      const lecture = await uploadAudioLectureApi(
        selectedFile,
        titleInput.trim() || selectedFile.name,
        activeNotebookId
      );
      setLectures((prev) => [lecture, ...prev]);
      setActiveId(lecture.id);
      setSelectedFile(null);
      setTitleInput('');
      onToast?.(`Transcribed audio lecture "${lecture.title}"`, 'success');
    } catch (err: any) {
      setError(err?.message || 'Audio lecture transcription failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAudioLectureApi(id);
      const rest = lectures.filter((l) => l.id !== id);
      setLectures(rest);
      setActiveId(rest[0]?.id || null);
    } catch (err: any) {
      setError(err?.message || 'Could not delete audio lecture.');
    }
  };

  const handleSaveFlashcards = () => {
    if (!activeLecture || activeLecture.flashcards.length === 0) return;
    const newSet: FlashcardSet = {
      id: `fc-${Date.now()}`,
      notebookId: activeNotebookId || activeLecture.notebookId,
      title: `${activeLecture.title} (Lecture Cards)`,
      description: `Flashcards generated from audio lecture "${activeLecture.title}"`,
      category: 'Audio Lecture',
      createdAt: new Date().toISOString().slice(0, 10),
      cards: activeLecture.flashcards.map((c, idx) => ({
        id: `c-${Date.now()}-${idx}`,
        question: c.question,
        answer: c.answer,
        hint: c.hint,
        status: 'unstudied',
        box: 1,
        easeFactor: 2.5,
      })),
    };
    onAddFlashcardSet?.(newSet);
    setSavedNotice('Starter flashcards saved to Flashcards tab.');
    onToast?.('Starter flashcards added to your notebook.', 'success');
  };

  const handleSaveQuiz = () => {
    if (!activeLecture || activeLecture.quizQuestions.length === 0) return;
    const quiz: QuizSet = {
      id: `qz-${Date.now()}`,
      notebookId: activeNotebookId || activeLecture.notebookId,
      title: `${activeLecture.title} (Lecture Quiz)`,
      description: `Quiz generated from audio lecture "${activeLecture.title}"`,
      difficulty: 'medium',
      createdAt: new Date().toISOString().slice(0, 10),
      questions: activeLecture.quizQuestions.map((q, idx) => ({
        id: `q-${Date.now()}-${idx}`,
        type: 'multiple-choice',
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
      })),
    };
    onAddQuizSet?.(quiz);
    setSavedNotice('Practice quiz saved to Quizzes tab.');
    onToast?.('Practice quiz added to your notebook.', 'success');
  };

  const handleSaveRevisionNote = async () => {
    if (!activeLecture) return;
    const note: NoteItem = {
      id: `note-${Date.now()}`,
      notebookId: activeNotebookId || activeLecture.notebookId,
      title: `${activeLecture.title} — Lecture Notes`,
      content: `${activeLecture.summary}\n\n## Key Concepts\n${activeLecture.keyConcepts
        .map((c) => `- ${c}`)
        .join('\n')}\n\n## Revision Notes\n${activeLecture.revisionNotes}`,
      tags: ['audio-lecture', 'revision'],
      aiGenerated: true,
      updatedAt: new Date().toISOString(),
    };
    await onSaveNote?.(note, true);
    setSavedNotice('Revision note saved to Smart Notes tab.');
    onToast?.('Revision note saved to Smart Notes.', 'success');
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Mic className="w-6 h-6 text-indigo-500" /> Audio Lecture Assistant
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Upload recorded lectures (MP3, WAV, WebM, M4A, OGG, FLAC up to 15MB) for transcription, timestamps, summaries, flashcards, quizzes, and revision notes.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs rounded-xl">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload & Library */}
        <div className="space-y-6">
          <form
            onSubmit={handleUpload}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4"
          >
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-indigo-500" /> Upload Recorded Lecture
            </h2>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) validateAndStageFile(f);
              }}
              className={`border-2 border-dashed rounded-2xl p-5 text-center transition-colors ${
                dragOver
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40'
              }`}
            >
              <FileAudio className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {selectedFile
                  ? `${selectedFile.name} (${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)`
                  : 'Drag & drop audio file here, or choose file'}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                MP3, WAV, WebM, M4A, OGG, FLAC • Max 15 MB
              </p>
              <label className="inline-block mt-3 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer">
                Choose Audio File
                <input
                  type="file"
                  accept="audio/*,.mp3,.wav,.webm,.m4a,.ogg,.flac"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) validateAndStageFile(f);
                  }}
                />
              </label>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Lecture Title
              </label>
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                placeholder="e.g. Week 4 - Distributed Consensus"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <button
              type="submit"
              disabled={!selectedFile || uploading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2"
            >
              <Sparkles className={`w-4 h-4 ${uploading ? 'animate-spin' : ''}`} />
              <span>{uploading ? 'Transcribing & Structuring...' : 'Transcribe & Generate Notes'}</span>
            </button>
          </form>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Recorded Lectures ({lectures.length})
            </h3>
            {loading ? (
              <div className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
            ) : lectures.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                No audio lectures uploaded yet.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {lectures.map((lec) => (
                  <div
                    key={lec.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                      lec.id === activeLecture?.id
                        ? 'bg-indigo-500/10 border-indigo-500/40'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActiveId(lec.id);
                        setSavedNotice('');
                      }}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {lec.title}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {Math.round(lec.fileSizeBytes / 1024)} KB •{' '}
                        {new Date(lec.createdAt).toLocaleDateString()}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(lec.id)}
                      aria-label={`Delete lecture ${lec.title}`}
                      className="p-1 text-slate-400 hover:text-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Lecture Breakdown */}
        <div className="lg:col-span-2">
          {activeLecture ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    {activeLecture.title}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {activeLecture.originalFilename} ({activeLecture.mimeType})
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleSaveFlashcards}
                    disabled={activeLecture.flashcards.length === 0}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-500 text-xs font-bold flex items-center gap-1 disabled:opacity-40"
                  >
                    <Layers className="w-3.5 h-3.5" /> Save Flashcards ({activeLecture.flashcards.length})
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveQuiz}
                    disabled={activeLecture.quizQuestions.length === 0}
                    className="px-3 py-1.5 rounded-xl bg-pink-500/15 hover:bg-pink-500/25 text-pink-500 text-xs font-bold flex items-center gap-1 disabled:opacity-40"
                  >
                    <HelpCircle className="w-3.5 h-3.5" /> Save Quiz ({activeLecture.quizQuestions.length})
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveRevisionNote}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-500 text-xs font-bold flex items-center gap-1"
                  >
                    <BookOpen className="w-3.5 h-3.5" /> Save Revision Note
                  </button>
                </div>
              </div>

              {savedNotice && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{savedNotice}</span>
                </div>
              )}

              {/* Honest Speaker Diarization Notice */}
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2">
                <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <span>{activeLecture.speakerNotesNotice}</span>
              </div>

              {/* Summary & Key Concepts */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Lecture Summary
                </h3>
                <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {activeLecture.summary}
                </p>
                {activeLecture.keyConcepts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {activeLecture.keyConcepts.map((c, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[11px] font-semibold"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Timestamped Transcript */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Timestamped Transcript
                </h3>
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {activeLecture.transcriptSegments.length > 0 ? (
                    activeLecture.transcriptSegments.map((seg, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-start gap-3 text-xs"
                      >
                        <span className="font-mono font-bold text-indigo-500 shrink-0">
                          {seg.timestamp}
                        </span>
                        <span className="text-slate-700 dark:text-slate-200 leading-relaxed">
                          {seg.text}
                        </span>
                      </div>
                    ))
                  ) : (
                    <pre className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs whitespace-pre-wrap font-sans">
                      {activeLecture.transcriptText}
                    </pre>
                  )}
                </div>
              </div>

              {/* Structured Revision Notes */}
              {activeLecture.revisionNotes && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Generated Revision Notes
                  </h3>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {activeLecture.revisionNotes}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <Mic className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                Upload an audio lecture to begin
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Drop an MP3, WAV, M4A, OGG, FLAC, or WebM recording on the left to extract a timestamped transcript and starter study materials.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
