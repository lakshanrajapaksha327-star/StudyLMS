import { auth } from '../lib/firebase';
import {
  AudioLectureItem,
  ChatMessage,
  DiagramEdge,
  DiagramNode,
  DocumentAnnotation,
  DocumentCitation,
  ExamPrepGuide,
  Flashcard,
  FlashcardSet,
  LearningAnalyticsData,
  Notebook,
  NoteItem,
  NoteVersionItem,
  PersonalizedInsightsData,
  QuizAttemptItem,
  QuizQuestion,
  QuizSet,
  RevisionScheduleData,
  SourceDocument,
  StudySessionItem,
  StudyTaskItem,
  TopicMasteryItem,
  VisualDiagram,
} from '../types';

async function getAuthHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Please sign in with Google or email to use cloud workspace & AI features.');
  }
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const isFormData = init.body instanceof FormData;
  const headers = await getAuthHeaders(
    isFormData ? {} : { 'Content-Type': 'application/json' }
  );
  const resp = await fetch(url, {
    ...init,
    headers: {
      ...headers,
      ...(init.headers || {}),
    },
  });

  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({}));
    throw new Error(errData.error || `Request failed (${resp.status})`);
  }

  return resp;
}

// ---------------- AUTH & WORKSPACE BOOTSTRAP ----------------
export async function fetchWorkspaceBootstrap(): Promise<any> {
  const resp = await apiFetch('/api/workspace/bootstrap');
  return resp.json();
}

export async function updateSessionProfile(updates: Partial<{
  name: string;
  avatar: string;
  studyGoalMinutes: number;
  cardsMastered: number;
  quizzesCompleted: number;
  timeSpentMinutes: number;
  streakDays: number;
}>): Promise<any> {
  const resp = await apiFetch('/api/v1/auth/session', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return resp.json();
}

export async function migrateLocalWorkspace(payload: {
  notebooks: Notebook[];
  sources: SourceDocument[];
  notes: NoteItem[];
  flashcardSets: FlashcardSet[];
  quizSets: QuizSet[];
}): Promise<any> {
  const resp = await apiFetch('/api/workspace/migrate-local', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return resp.json();
}

// ---------------- NOTEBOOKS ----------------
export async function saveNotebookApi(notebook: Partial<Notebook>): Promise<Notebook> {
  const resp = await apiFetch('/api/notebooks', {
    method: 'POST',
    body: JSON.stringify(notebook),
  });
  const data = await resp.json();
  return data.notebook;
}

export async function deleteNotebookApi(id: string, cascade = false): Promise<boolean> {
  await apiFetch(
    `/api/notebooks/${encodeURIComponent(id)}${cascade ? '?cascade=true' : ''}`,
    { method: 'DELETE' }
  );
  return true;
}

// ---------------- DOCUMENTS & RAG ----------------
export async function uploadDocument(
  file: File | null,
  pastedText: string,
  title: string,
  notebookId?: string
): Promise<{ document: SourceDocument; flashcards: Partial<Flashcard>[] }> {
  const formData = new FormData();
  if (file) formData.append('file', file);
  if (pastedText) formData.append('pastedText', pastedText);
  if (title) formData.append('title', title);
  if (notebookId) formData.append('notebookId', notebookId);

  const resp = await apiFetch('/api/upload-document', {
    method: 'POST',
    body: formData,
  });
  return resp.json();
}

export async function renameDocumentApi(id: string, title: string): Promise<SourceDocument> {
  const resp = await apiFetch(`/api/documents/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  });
  const data = await resp.json();
  return data.document;
}

export async function replaceDocumentFileApi(
  id: string,
  file: File
): Promise<{ document: SourceDocument; flashcards: Partial<Flashcard>[] }> {
  const formData = new FormData();
  formData.append('file', file);
  const resp = await apiFetch(`/api/documents/${encodeURIComponent(id)}/file`, {
    method: 'PUT',
    body: formData,
  });
  return resp.json();
}

export async function reindexDocumentApi(
  id: string
): Promise<{ document: SourceDocument; flashcards: Partial<Flashcard>[] }> {
  const resp = await apiFetch(`/api/documents/${encodeURIComponent(id)}/reindex`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return resp.json();
}

export async function deleteDocumentApi(id: string): Promise<boolean> {
  await apiFetch(`/api/documents/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return true;
}

export async function fetchDocumentContentApi(id: string): Promise<{
  document: SourceDocument;
  fullText: string;
  chunks: Array<{
    id: string;
    chunkIndex: number;
    pageNumber?: number;
    slideNumber?: number;
    sectionHeading?: string;
    content: string;
  }>;
}> {
  const resp = await apiFetch(`/api/documents/${encodeURIComponent(id)}/content`);
  return resp.json();
}

export async function searchInsideDocumentApi(id: string, q: string): Promise<any[]> {
  const resp = await apiFetch(
    `/api/documents/${encodeURIComponent(id)}/search?q=${encodeURIComponent(q)}`
  );
  const data = await resp.json();
  return data.matches || [];
}

export async function downloadOriginalDocumentApi(id: string, fallbackFilename: string): Promise<void> {
  const resp = await apiFetch(`/api/documents/${encodeURIComponent(id)}/download`);
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fallbackFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function retrieveRagContextApi(params: {
  query: string;
  notebookId?: string;
  selectedDocumentIds?: string[];
  topK?: number;
}): Promise<{ citations: DocumentCitation[]; formattedContext: string; hasEvidence: boolean }> {
  const resp = await apiFetch('/api/rag/retrieve', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return resp.json();
}

// ---------------- STUDY NOTES + VERSIONS ----------------
export async function saveNoteApi(note: Partial<NoteItem> & { saveVersion?: boolean }): Promise<NoteItem> {
  const resp = await apiFetch('/api/notes', {
    method: 'POST',
    body: JSON.stringify(note),
  });
  const data = await resp.json();
  return data.note;
}

export async function fetchNoteVersionsApi(noteId: string): Promise<NoteVersionItem[]> {
  const resp = await apiFetch(`/api/notes/${encodeURIComponent(noteId)}/versions`);
  const data = await resp.json();
  return data.versions || [];
}

export async function deleteNoteApi(id: string): Promise<boolean> {
  await apiFetch(`/api/notes/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return true;
}

// ---------------- STUDY CHAT & HISTORY ----------------
export async function sendStudyChat(
  messages: ChatMessage[],
  sources: SourceDocument[],
  notebookTitle: string,
  persona: string = 'Standard Tutor',
  options?: {
    notebookId?: string;
    selectedDocumentIds?: string[];
    sessionId?: string;
    strictGrounded?: boolean;
    signal?: AbortSignal;
  }
): Promise<{
  text: string;
  suggestedQuestions: string[];
  sourcesUsed: string[];
  citations: DocumentCitation[];
  sessionId?: string;
  grounded?: boolean;
}> {
  const resp = await apiFetch('/api/chat', {
    method: 'POST',
    signal: options?.signal,
    body: JSON.stringify({
      messages,
      sources: sources.map((s) => ({ id: s.id, title: s.title, content: s.content })),
      notebookTitle,
      persona,
      notebookId: options?.notebookId || sources[0]?.notebookId,
      selectedDocumentIds: options?.selectedDocumentIds,
      sessionId: options?.sessionId,
      strictGrounded: options?.strictGrounded ?? true,
    }),
  });
  return resp.json();
}

export async function fetchChatHistorySessions(): Promise<any[]> {
  const resp = await apiFetch('/api/chat-history/sessions');
  const data = await resp.json();
  return data.sessions || [];
}

export async function fetchChatHistorySessionById(id: string): Promise<any | null> {
  const resp = await apiFetch(`/api/chat-history/sessions/${encodeURIComponent(id)}`);
  const data = await resp.json();
  return data.session || null;
}

export async function createChatHistorySession(
  title: string,
  messages: ChatMessage[],
  persona = 'Standard Tutor',
  notebookId?: string
): Promise<any> {
  const resp = await apiFetch('/api/chat-history/sessions', {
    method: 'POST',
    body: JSON.stringify({ title, messages, persona, notebookId }),
  });
  const data = await resp.json();
  return data.session;
}

export async function renameChatSession(id: string, title: string): Promise<any> {
  const resp = await apiFetch(`/api/chat-history/sessions/${encodeURIComponent(id)}/rename`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  });
  const data = await resp.json();
  return data.session;
}

export async function archiveChatSession(id: string, isArchived = true): Promise<any> {
  const resp = await apiFetch(`/api/chat-history/sessions/${encodeURIComponent(id)}/archive`, {
    method: 'PATCH',
    body: JSON.stringify({ isArchived }),
  });
  const data = await resp.json();
  return data.session;
}

export async function searchChatSessions(q: string): Promise<any[]> {
  const resp = await apiFetch(`/api/chat-history/search?q=${encodeURIComponent(q)}`);
  const data = await resp.json();
  return data.sessions || [];
}

export async function deleteChatHistorySession(id: string): Promise<boolean> {
  await apiFetch(`/api/chat-history/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return true;
}

export async function clearAllChatHistory(): Promise<boolean> {
  await apiFetch('/api/chat-history/clear-all', { method: 'DELETE' });
  return true;
}

// ---------------- NOTION AI, EXPLANATION, SPEECH ----------------
export async function runNotionAIAction(
  action: string,
  noteContent: string,
  noteTitle: string
): Promise<string> {
  const resp = await apiFetch('/api/notion-ai', {
    method: 'POST',
    body: JSON.stringify({ action, noteContent, noteTitle }),
  });
  const data = await resp.json();
  return data.result;
}

export async function generateAIExplanation(
  concept: string,
  mode: string = 'socratic',
  context?: string
): Promise<{
  concept: string;
  mode: string;
  explanation: string;
  keyTakeaways: string[];
  suggestedFollowUps: string[];
}> {
  const resp = await apiFetch('/api/explanation', {
    method: 'POST',
    body: JSON.stringify({ concept, mode, context }),
  });
  return resp.json();
}

export async function generateSpeechAudio(text: string, voice = 'Kore'): Promise<string> {
  const resp = await apiFetch('/api/speech', {
    method: 'POST',
    body: JSON.stringify({ text, voice }),
  });
  const data = await resp.json();
  return data.audioBase64;
}

// ---------------- FLASHCARDS & QUIZZES ----------------
export async function generateAIFlashcards(
  topic: string,
  sourceContent: string,
  cardCount: number = 5,
  notebookId?: string
): Promise<Partial<Flashcard>[]> {
  const resp = await apiFetch('/api/generate-flashcards', {
    method: 'POST',
    body: JSON.stringify({ topic, sourceContent, cardCount, notebookId }),
  });
  const data = await resp.json();
  return data.cards;
}

export async function saveFlashcardSetApi(set: FlashcardSet): Promise<FlashcardSet> {
  const resp = await apiFetch('/api/flashcard-sets', {
    method: 'POST',
    body: JSON.stringify(set),
  });
  const data = await resp.json();
  return data.set;
}

export async function updateFlashcardSetApi(set: FlashcardSet): Promise<FlashcardSet> {
  const resp = await apiFetch(`/api/flashcard-sets/${encodeURIComponent(set.id)}`, {
    method: 'PATCH',
    body: JSON.stringify(set),
  });
  const data = await resp.json();
  return data.set;
}

export async function deleteFlashcardSetApi(id: string): Promise<boolean> {
  await apiFetch(`/api/flashcard-sets/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return true;
}

export async function generateAIQuiz(
  topic: string,
  sourceContent: string,
  questionCount: number = 4,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
  notebookId?: string,
  questionFormat: string = 'mixed',
  selectedDocumentIds?: string[]
): Promise<Partial<QuizQuestion>[]> {
  const resp = await apiFetch('/api/generate-quiz', {
    method: 'POST',
    body: JSON.stringify({
      topic,
      sourceContent,
      questionCount,
      difficulty,
      questionFormat,
      notebookId,
      selectedDocumentIds,
    }),
  });
  const data = await resp.json();
  return data.questions;
}

export async function evaluateShortAnswerApi(params: {
  question: string;
  expectedAnswer: string;
  studentAnswer: string;
}): Promise<{ isCorrect: boolean; scorePercent: number; feedback: string; missingPoints?: string[] }> {
  const resp = await apiFetch('/api/quizzes/evaluate-answer', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  const data = await resp.json();
  return data.evaluation;
}

export async function saveQuizSetApi(quiz: QuizSet): Promise<QuizSet> {
  const resp = await apiFetch('/api/quizzes', {
    method: 'POST',
    body: JSON.stringify(quiz),
  });
  const data = await resp.json();
  return data.quiz;
}

export async function submitQuizAttemptApi(attempt: {
  quizSetId: string;
  quizTitle: string;
  score: number;
  scorePercent: number;
  totalQuestions: number;
  correctCount: number;
  timeTakenSeconds?: number;
  answers?: Record<string, string>;
}): Promise<QuizAttemptItem> {
  const resp = await apiFetch('/api/quizzes/attempts', {
    method: 'POST',
    body: JSON.stringify(attempt),
  });
  const data = await resp.json();
  return data.attempt;
}

export async function fetchQuizAttemptsApi(): Promise<QuizAttemptItem[]> {
  const resp = await apiFetch('/api/quizzes/attempts');
  const data = await resp.json();
  return data.attempts || [];
}

// ---------------- STUDY PLANNER & TASKS ----------------
export async function generateStudyPlan(params: {
  subjects: string[];
  examDate: string;
  hoursPerDay: number;
  focusAreas?: string;
  weakTopics?: string[];
  strongTopics?: string[];
  preferredStudyTime?: string;
}): Promise<any> {
  const resp = await apiFetch('/api/study-planner/generate', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  const data = await resp.json();
  return data.plan;
}

export async function recalibrateStudyPlan(params: {
  planId: string;
  missedTopics: string[];
  daysRemaining?: number;
}): Promise<any> {
  const resp = await apiFetch('/api/study-planner/recalibrate', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  const data = await resp.json();
  return data.plan;
}

export async function toggleStudyTopic(planId: string, topicId: string): Promise<any> {
  const resp = await apiFetch('/api/study-planner/toggle-topic', {
    method: 'POST',
    body: JSON.stringify({ planId, topicId }),
  });
  const data = await resp.json();
  return data.plan;
}

export async function fetchLatestStudyPlan(): Promise<any | null> {
  const resp = await apiFetch('/api/study-planner/latest');
  const data = await resp.json();
  return data.plan || null;
}

export async function saveTaskApi(task: Partial<StudyTaskItem>): Promise<StudyTaskItem> {
  const resp = await apiFetch('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(task),
  });
  const data = await resp.json();
  return data.task;
}

export async function deleteTaskApi(id: string): Promise<boolean> {
  await apiFetch(`/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return true;
}

// ---------------- PREFERENCES, TELEMETRY, HISTORY, SEARCH, NOTIFICATIONS ----------------
export async function fetchUserPreferences(): Promise<any> {
  const resp = await apiFetch('/api/user-preferences');
  const data = await resp.json();
  return data.preferences;
}

export async function updateUserPreferences(updates: any): Promise<any> {
  const resp = await apiFetch('/api/user-preferences', {
    method: 'POST',
    body: JSON.stringify({ updates }),
  });
  const data = await resp.json();
  return data.preferences;
}

export async function fetchAiLogs(): Promise<any> {
  const resp = await apiFetch('/api/ai-logs');
  return resp.json();
}

export async function fetchRecentSearches(): Promise<any[]> {
  const resp = await apiFetch('/api/search-history');
  const data = await resp.json();
  return data.searches || [];
}

export async function recordSearchHistory(
  keyword: string,
  category = 'all',
  resultCount = 0
): Promise<any> {
  const resp = await apiFetch('/api/search-history', {
    method: 'POST',
    body: JSON.stringify({ keyword, category, resultCount }),
  });
  const data = await resp.json();
  return data.entry;
}

export async function fetchRecentDocuments(): Promise<any[]> {
  const resp = await apiFetch('/api/recent-documents');
  const data = await resp.json();
  return data.items || [];
}

export async function recordDocumentAccess(
  documentId: string,
  documentTitle: string,
  documentType = 'pdf'
): Promise<any> {
  const resp = await apiFetch('/api/recent-documents', {
    method: 'POST',
    body: JSON.stringify({ documentId, documentTitle, documentType }),
  });
  const data = await resp.json();
  return data.entry;
}

export async function fetchNotificationsApi(): Promise<any[]> {
  const resp = await apiFetch('/api/notifications');
  const data = await resp.json();
  return data.notifications || [];
}

export async function markNotificationReadApi(id: string): Promise<any> {
  const resp = await apiFetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
    method: 'PATCH',
    body: JSON.stringify({}),
  });
  return resp.json();
}

export async function deleteNotificationApi(id: string): Promise<boolean> {
  await apiFetch(`/api/notifications/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return true;
}

export async function clearActivityLogsApi(): Promise<boolean> {
  await apiFetch('/api/activity-logs', { method: 'DELETE' });
  return true;
}

export async function fetchAdminOverviewApi(): Promise<any> {
  const resp = await apiFetch('/api/admin/overview');
  return resp.json();
}

export async function updateAdminUserApi(
  uid: string,
  updates: { role?: 'Student' | 'Educator' | 'Admin'; status?: 'Active' | 'Suspended' }
): Promise<any> {
  const resp = await apiFetch(`/api/admin/users/${encodeURIComponent(uid)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return resp.json();
}

export async function deleteAdminUserApi(uid: string): Promise<boolean> {
  await apiFetch(`/api/admin/users/${encodeURIComponent(uid)}`, { method: 'DELETE' });
  return true;
}

export async function fetchAiHealthApi(): Promise<any> {
  const resp = await apiFetch('/api/ai/health');
  return resp.json();
}

export async function fetchGlobalSearchApi(q: string, type = 'all'): Promise<{
  results: Array<{
    id: string;
    category: 'notebook' | 'document' | 'chunk' | 'note' | 'flashcard' | 'quiz' | 'chat';
    title: string;
    snippet: string;
    notebookId?: string;
    documentId?: string;
    meta?: string;
  }>;
  total: number;
  recentSearches: Array<{ id: string; keyword: string; category: string; createdAt: string }>;
}> {
  const resp = await apiFetch(`/api/search?q=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}`);
  return resp.json();
}

export async function fetchAnnotationsApi(documentId?: string): Promise<DocumentAnnotation[]> {
  const url = documentId
    ? `/api/annotations?documentId=${encodeURIComponent(documentId)}`
    : '/api/annotations';
  const resp = await apiFetch(url);
  const data = await resp.json();
  return data.annotations || [];
}

export async function saveAnnotationApi(
  item: Partial<DocumentAnnotation> & { documentId: string; content: string }
): Promise<DocumentAnnotation> {
  const resp = await apiFetch('/api/annotations', {
    method: 'POST',
    body: JSON.stringify(item),
  });
  const data = await resp.json();
  return data.annotation;
}

export async function deleteAnnotationApi(id: string): Promise<boolean> {
  await apiFetch(`/api/annotations/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return true;
}

export async function exportWorkspaceDataApi(): Promise<any> {
  const resp = await apiFetch('/api/workspace/export');
  return resp.json();
}

export async function deleteWorkspaceAccountApi(): Promise<boolean> {
  await apiFetch('/api/workspace/account', { method: 'DELETE' });
  return true;
}

export async function generateSummaryModeApi(params: {
  mode: string;
  title: string;
  sourceContent?: string;
  notebookId?: string;
  selectedDocumentIds?: string[];
}): Promise<{
  summary: {
    mode: string;
    title: string;
    contentMarkdown: string;
    keyPoints: string[];
    citationsUsed?: string[];
  };
  citations: DocumentCitation[];
}> {
  const resp = await apiFetch('/api/ai/summary', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return resp.json();
}

// ---------------- ADVANCED AI TOOLS ----------------
export async function transformSelectedText(
  text: string,
  action: 'explain' | 'rewrite' | 'translate' | 'simplify' | 'summarize' | 'expand' | 'key_points',
  option?: string
): Promise<{ resultText: string }> {
  const resp = await apiFetch('/api/ai/transform-text', {
    method: 'POST',
    body: JSON.stringify({ text, action, option }),
  });
  return resp.json();
}

export async function generateCitations(
  title: string,
  author?: string,
  year?: string,
  publisherUrl?: string
): Promise<{
  apa: string;
  harvard: string;
  ieee: string;
  mla: string;
  chicago: string;
  missingMetadataFields?: string[];
  verificationNotice?: string;
}> {
  const resp = await apiFetch('/api/ai/citations', {
    method: 'POST',
    body: JSON.stringify({ title, author, year, publisherUrl }),
  });
  const data = await resp.json();
  return data.citations;
}

export async function solveFormula(formula: string, givenVariables?: string): Promise<any> {
  const resp = await apiFetch('/api/ai/solve-formula', {
    method: 'POST',
    body: JSON.stringify({ formula, givenVariables }),
  });
  const data = await resp.json();
  return data.solution;
}

export async function analyzeCode(code: string, language = 'auto'): Promise<any> {
  const resp = await apiFetch('/api/ai/code-explainer', {
    method: 'POST',
    body: JSON.stringify({ code, language }),
  });
  const data = await resp.json();
  return data.analysis;
}

export async function predictExamQuestions(
  sourcesContent: string,
  notebookId?: string,
  syllabusNotes?: string,
  pastPaperNotes?: string
): Promise<any> {
  const resp = await apiFetch('/api/ai/predict-exam', {
    method: 'POST',
    body: JSON.stringify({ sourcesContent, notebookId, syllabusNotes, pastPaperNotes }),
  });
  const data = await resp.json();
  return data.examPredictions;
}

export async function synthesizeMultiDocuments(
  documents: { id?: string; title: string; content: string }[],
  query: string,
  mode: 'synthesis' | 'compare' | 'conflicts' | 'definitions' | 'timeline' = 'synthesis',
  notebookId?: string
): Promise<{ synthesisAnswer: string; sourcesAnalyzed: string[]; citations?: DocumentCitation[] }> {
  const resp = await apiFetch('/api/ai/multi-doc-synthesis', {
    method: 'POST',
    body: JSON.stringify({
      documents,
      documentIds: documents.map((d) => d.id).filter(Boolean),
      notebookId,
      query,
      mode,
    }),
  });
  const data = await resp.json();
  return data.synthesis;
}

export async function generatePowerPointSlides(
  topic: string,
  content?: string,
  slideCount = 5,
  notebookId?: string
): Promise<any> {
  const resp = await apiFetch('/api/ai/generate-slides', {
    method: 'POST',
    body: JSON.stringify({ topic, content, slideCount, notebookId }),
  });
  const data = await resp.json();
  return data.deck;
}

export async function generateDiagram(topic: string, diagramType = 'flowchart'): Promise<any> {
  const resp = await apiFetch('/api/ai/generate-diagram', {
    method: 'POST',
    body: JSON.stringify({ topic, diagramType }),
  });
  const data = await resp.json();
  return data.diagram;
}

export async function generateCheatSheet(
  topic: string,
  content?: string,
  notebookId?: string
): Promise<any> {
  const resp = await apiFetch('/api/ai/generate-cheatsheet', {
    method: 'POST',
    body: JSON.stringify({ topic, content, notebookId }),
  });
  const data = await resp.json();
  return data.cheatSheet;
}

export async function generateMnemonics(topic: string, itemsToRemember: string[]): Promise<any> {
  const resp = await apiFetch('/api/ai/generate-mnemonics', {
    method: 'POST',
    body: JSON.stringify({ topic, itemsToRemember }),
  });
  return resp.json();
}

export async function generateVivaQuestions(subject: string): Promise<any[]> {
  const resp = await apiFetch('/api/ai/viva-questions', {
    method: 'POST',
    body: JSON.stringify({ subject }),
  });
  const data = await resp.json();
  return data.questions;
}

export async function evaluateVivaAnswer(
  question: string,
  studentAnswer: string,
  expectedKeywords: string[]
): Promise<any> {
  const resp = await apiFetch('/api/ai/evaluate-viva', {
    method: 'POST',
    body: JSON.stringify({ question, studentAnswer, expectedKeywords }),
  });
  const data = await resp.json();
  return data.evaluation;
}

// ---------------- ADVANCED LEARNING WORKSTREAMS ----------------
export async function fetchPersonalizedInsightsApi(includeAi = false): Promise<PersonalizedInsightsData> {
  const resp = await apiFetch(`/api/learning/insights${includeAi ? '?ai=true' : ''}`);
  return resp.json();
}

export async function fetchTopicMasteriesApi(): Promise<TopicMasteryItem[]> {
  const resp = await apiFetch('/api/learning/topic-mastery');
  const data = await resp.json();
  return data.topics || [];
}

export async function runAdaptiveStepApi(payload: {
  topicMasteryId?: string;
  notebookId?: string;
  subject: string;
  topic: string;
  stage?: number;
  studentResponse?: string;
  checkQuestionAsked?: string;
}): Promise<{
  topicMastery: TopicMasteryItem;
  step: {
    misconceptionIdentified: string;
    simplerExplanation: string;
    extraExample: string;
    practicalAnalogy: string;
    checkQuestion: string;
    evaluationFeedback: string;
    understood: boolean;
    recommendedMasteryDelta: number;
    nextDifficulty: 'foundational' | 'intermediate' | 'advanced';
  };
}> {
  const resp = await apiFetch('/api/learning/adaptive-step', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return resp.json();
}

export async function deleteTopicMasteryApi(id: string): Promise<boolean> {
  await apiFetch(`/api/learning/topic-mastery/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return true;
}

export async function fetchRevisionScheduleApi(): Promise<RevisionScheduleData> {
  const resp = await apiFetch('/api/learning/revision-schedule');
  return resp.json();
}

export async function rescheduleRevisionItemApi(params: {
  sourceType: 'flashcard_deck' | 'topic_mastery' | 'study_task';
  sourceId: string;
  newDate: string;
}): Promise<any> {
  const resp = await apiFetch('/api/learning/revision-schedule/reschedule', {
    method: 'PATCH',
    body: JSON.stringify(params),
  });
  return resp.json();
}

export async function fetchExamPrepGuidesApi(notebookId?: string): Promise<ExamPrepGuide[]> {
  const url = notebookId
    ? `/api/exam-prep?notebookId=${encodeURIComponent(notebookId)}`
    : '/api/exam-prep';
  const resp = await apiFetch(url);
  const data = await resp.json();
  return data.guides || [];
}

export async function generateExamPrepGuideApi(payload: {
  notebookId?: string;
  subject: string;
  examDate: string;
  syllabusText?: string;
  pastPaperNotes?: string;
  selectedDocumentIds?: string[];
}): Promise<ExamPrepGuide> {
  const resp = await apiFetch('/api/exam-prep/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = await resp.json();
  return data.guide;
}

export async function updateExamPrepChecklistApi(
  id: string,
  revisionChecklist: Array<{ id: string; item: string; completed: boolean }>
): Promise<ExamPrepGuide> {
  const resp = await apiFetch(`/api/exam-prep/${encodeURIComponent(id)}/checklist`, {
    method: 'PATCH',
    body: JSON.stringify({ revisionChecklist }),
  });
  const data = await resp.json();
  return data.guide;
}

export async function deleteExamPrepGuideApi(id: string): Promise<boolean> {
  await apiFetch(`/api/exam-prep/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return true;
}

export async function fetchDiagramsApi(notebookId?: string): Promise<VisualDiagram[]> {
  const url = notebookId
    ? `/api/diagrams?notebookId=${encodeURIComponent(notebookId)}`
    : '/api/diagrams';
  const resp = await apiFetch(url);
  const data = await resp.json();
  return data.diagrams || [];
}

export async function generateDiagramApi(payload: {
  notebookId?: string;
  topic: string;
  diagramType: string;
  selectedDocumentIds?: string[];
}): Promise<VisualDiagram> {
  const resp = await apiFetch('/api/diagrams/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = await resp.json();
  return data.diagram;
}

export async function saveDiagramApi(payload: {
  id?: string;
  notebookId?: string;
  title: string;
  diagramType?: string;
  description?: string;
  nodes?: DiagramNode[];
  edges?: DiagramEdge[];
  mermaidSyntax?: string;
}): Promise<VisualDiagram> {
  const resp = await apiFetch('/api/diagrams', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = await resp.json();
  return data.diagram;
}

export async function deleteDiagramApi(id: string): Promise<boolean> {
  await apiFetch(`/api/diagrams/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return true;
}

export async function fetchAudioLecturesApi(notebookId?: string): Promise<AudioLectureItem[]> {
  const url = notebookId
    ? `/api/audio-lectures?notebookId=${encodeURIComponent(notebookId)}`
    : '/api/audio-lectures';
  const resp = await apiFetch(url);
  const data = await resp.json();
  return data.lectures || [];
}

export async function uploadAudioLectureApi(
  file: File,
  title?: string,
  notebookId?: string,
  durationSeconds?: number
): Promise<AudioLectureItem> {
  const formData = new FormData();
  formData.append('audio', file);
  if (title) formData.append('title', title);
  if (notebookId) formData.append('notebookId', notebookId);
  if (durationSeconds !== undefined) formData.append('durationSeconds', String(durationSeconds));

  const resp = await apiFetch('/api/audio-lectures/upload', {
    method: 'POST',
    body: formData,
  });
  const data = await resp.json();
  return data.lecture;
}

export async function deleteAudioLectureApi(id: string): Promise<boolean> {
  await apiFetch(`/api/audio-lectures/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return true;
}

export async function fetchStudySessionsApi(): Promise<StudySessionItem[]> {
  const resp = await apiFetch('/api/study-sessions');
  const data = await resp.json();
  return data.sessions || [];
}

export async function createStudySessionApi(payload: {
  notebookId?: string;
  subject: string;
  activityType?: StudySessionItem['activityType'];
  startedAt: string;
  endedAt: string;
  activeDurationSeconds: number;
  pausedSeconds?: number;
  notes?: string;
}): Promise<StudySessionItem> {
  const resp = await apiFetch('/api/study-sessions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = await resp.json();
  return data.session;
}

export async function deleteStudySessionApi(id: string): Promise<boolean> {
  await apiFetch(`/api/study-sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return true;
}

export async function fetchLearningAnalyticsApi(
  range: '7d' | '30d' | '90d' | 'all' = '30d'
): Promise<LearningAnalyticsData> {
  const resp = await apiFetch(`/api/analytics?range=${encodeURIComponent(range)}`);
  return resp.json();
}

export async function importWorkspaceItemsApi(payload: {
  kind: 'flashcards' | 'notes';
  notebookId?: string;
  title?: string;
  cards?: Array<{ question: string; answer: string; hint?: string }>;
  notes?: Array<{ title: string; content: string; tags?: string[] }>;
}): Promise<{
  success: boolean;
  importedCount: number;
  flashcardSet?: FlashcardSet;
  notes?: NoteItem[];
}> {
  const resp = await apiFetch('/api/workspace/import', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return resp.json();
}

