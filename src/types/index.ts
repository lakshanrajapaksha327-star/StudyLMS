export type ActiveTab =
  | 'landing'
  | 'dashboard'
  | 'planner'
  | 'notebooklm'
  | 'chat'
  | 'notes'
  | 'summary'
  | 'flashcards'
  | 'quiz'
  | 'toolkit'
  | 'adaptive'
  | 'examprep'
  | 'visuals'
  | 'audio'
  | 'analytics'
  | 'history'
  | 'settings'
  | 'admin';

export type DocumentProcessingStatus =
  | 'uploaded'
  | 'validating'
  | 'extracting'
  | 'ocr_processing'
  | 'chunking'
  | 'embedding'
  | 'indexing'
  | 'ready'
  | 'partially_processed'
  | 'failed';

export interface DocumentCitation {
  documentId: string;
  documentTitle: string;
  chunkId?: string;
  chunkIndex?: number;
  pageNumber?: number;
  slideNumber?: number;
  sectionHeading?: string;
  excerpt: string;
  score?: number;
}

export interface SourceDocument {
  id: string;
  notebookId: string;
  title: string;
  originalFilename?: string;
  type: 'pdf' | 'docx' | 'pptx' | 'xlsx' | 'csv' | 'text' | 'markdown' | 'image' | 'pasted' | 'url';
  mimeType?: string;
  fileSizeBytes?: number;
  content: string;
  fileSize?: string;
  storageRef?: string;
  processingStatus?: DocumentProcessingStatus;
  progressPercent?: number;
  chunkCount?: number;
  pageCount?: number;
  embeddingModel?: string;
  ocrWarnings?: string;
  errorMessage?: string;
  addedAt: string;
  updatedAt?: string;
  summary?: string;
  keyConcepts?: string[];
  citationCount?: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  sourcesUsed?: string[];
  suggestedQuestions?: string[];
  citations?: DocumentCitation[];
  audioUrl?: string;
  isStreaming?: boolean;
}

export interface NoteItem {
  id: string;
  notebookId: string;
  title: string;
  content: string;
  createdAt?: string;
  updatedAt: string;
  tags: string[];
  aiGenerated?: boolean;
}

export interface NoteVersionItem {
  id: string;
  noteId: string;
  title: string;
  content: string;
  savedAt: string;
}

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  hint?: string;
  status?: 'unstudied' | 'learning' | 'mastered';
  box?: number;
  easeFactor?: number;
  intervalDays?: number;
  repetitions?: number;
  nextReviewDate?: string;
  starred?: boolean;
  difficult?: boolean;
}

export interface FlashcardSet {
  id: string;
  notebookId: string;
  title: string;
  description: string;
  cards: Flashcard[];
  createdAt: string;
  updatedAt?: string;
  category: string;
}

export interface QuizQuestion {
  id: string;
  type:
    | 'multiple-choice'
    | 'true-false'
    | 'short-answer'
    | 'fill-in-the-blank'
    | 'matching'
    | 'scenario';
  question: string;
  options?: string[];
  matchingPairs?: Array<{ left: string; right: string }>;
  correctAnswer: string;
  explanation: string;
  sourceDocId?: string;
}

export interface QuizSet {
  id: string;
  notebookId: string;
  title: string;
  description: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  bestScore?: number;
  questions: QuizQuestion[];
  createdAt: string;
  updatedAt?: string;
}

export interface QuizAttemptItem {
  id: string;
  quizSetId: string;
  quizTitle?: string;
  score: number;
  scorePercent?: number;
  totalQuestions: number;
  correctCount: number;
  timeTakenSeconds?: number;
  answers?: Record<string, string>;
  completedAt: string;
}

export interface Notebook {
  id: string;
  title: string;
  description: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudyStats {
  cardsMastered: number;
  quizzesCompleted: number;
  studyStreakDays: number;
  timeSpentMinutes: number;
  lastActive: string;
}

export interface StudyTaskItem {
  id: string;
  title: string;
  subject?: string;
  scheduledDate?: string;
  durationMinutes?: number;
  completed: boolean;
  priority?: 'low' | 'medium' | 'high';
  taskType?: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'reminder' | 'exam' | 'flashcard' | 'streak' | 'document';
  read: boolean;
  createdAt: string;
}

export interface DocumentAnnotation {
  id: string;
  documentId: string;
  notebookId: string;
  pageNumber?: number;
  content: string;
  type: 'sticky_note' | 'highlight' | 'bookmark';
  createdAt: string;
  updatedAt?: string;
}

export interface AiProviderHealthInfo {
  id: 'gemini' | 'openai' | 'anthropic';
  displayName: string;
  configured: boolean;
  available: boolean;
  configuredModel: string;
  status: 'healthy' | 'degraded' | 'open_circuit' | 'unavailable';
  circuitState: 'closed' | 'open' | 'half_open';
  cooldownRemainingMs: number;
  lastLatencyMs: number | null;
  recentFailureRate: number;
  totalRequests: number;
  totalFailures: number;
  lastErrorCategory: string | null;
  lastCheckedAt: string | null;
}

export interface HistoryLogItem {
  id: string;
  type:
    | 'source_added'
    | 'quiz_completed'
    | 'flashcard_review'
    | 'ai_note_generated'
    | 'chat_query'
    | 'summary_generated'
    | 'planner_completed'
    | 'study_session'
    | 'exam_prep'
    | 'adaptive_tutor'
    | 'audio_lecture'
    | 'diagram_created';
  title: string;
  details: string;
  timestamp: string;
  score?: string;
}

export interface UserProfile {
  uid?: string;
  name: string;
  email: string;
  avatar: string;
  role: 'Student' | 'Educator' | 'Admin';
  studyGoalMinutes: number;
  preferredAIModel: string;
}

export interface AdminMetric {
  totalUsers: number;
  activeToday: number;
  aiTokensUsed: number;
  aiRequestsTotal?: number;
  aiErrorsTotal?: number;
  avgAiLatencyMs?: number;
  documentsIndexed: number;
  systemHealth: 'Optimal' | 'Healthy' | 'Degraded' | 'Warning' | 'Maintenance';
}

export interface StudySessionItem {
  id: string;
  notebookId?: string;
  subject: string;
  activityType: 'reading' | 'flashcards' | 'quiz' | 'notes' | 'exam_prep' | 'audio' | 'general';
  startedAt: string;
  endedAt: string;
  activeDurationSeconds: number;
  pausedSeconds: number;
  notes?: string;
  createdAt: string;
}

export interface DiagramNode {
  id: string;
  label: string;
  x: number;
  y: number;
  category?: string;
  notes?: string;
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface VisualDiagram {
  id: string;
  notebookId: string;
  title: string;
  diagramType: string;
  description?: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  mermaidSyntax?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExamPrepGuide {
  id: string;
  notebookId: string;
  subject: string;
  examDate: string;
  syllabusSummary?: string;
  topicPlan: Array<{
    topic: string;
    priority: 'high' | 'medium' | 'low';
    estimatedHours: number;
    rationale: string;
  }>;
  importantConcepts: string[];
  recurringThemes: string[];
  likelyTopics: Array<{
    topic: string;
    likelihood: 'high' | 'medium' | 'low';
    evidenceBasis: string;
    isEstimate: boolean;
  }>;
  practiceQuestions: Array<{
    question: string;
    modelAnswer: string;
    marks?: number;
  }>;
  formulaSheet: Array<{
    name: string;
    formula: string;
    usageNote: string;
  }>;
  revisionChecklist: Array<{
    id: string;
    item: string;
    completed: boolean;
  }>;
  mockExamQuestions: Array<{
    question: string;
    options?: string[];
    correctAnswer: string;
    explanation: string;
  }>;
  evidenceSources?: string[];
  uncertaintyNotice: string;
  createdAt: string;
  updatedAt: string;
}

export interface TopicMasteryItem {
  id: string;
  notebookId?: string;
  subject: string;
  topic: string;
  masteryLevel: number;
  difficultyLevel: 'foundational' | 'intermediate' | 'advanced';
  status: 'struggling' | 'learning' | 'proficient' | 'mastered';
  attemptsCount: number;
  correctCount: number;
  lastReviewedAt: string;
  nextReviewDate: string;
  struggleNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AudioLectureItem {
  id: string;
  notebookId: string;
  title: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  durationSeconds?: number;
  transcriptText: string;
  transcriptSegments: Array<{
    timestamp: string;
    text: string;
  }>;
  speakerNotesAvailable: boolean;
  speakerNotesNotice: string;
  summary: string;
  keyConcepts: string[];
  flashcards: Array<{ question: string; answer: string; hint?: string }>;
  quizQuestions: Array<{
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
  }>;
  revisionNotes: string;
  createdAt: string;
}

export interface PersonalizedInsightsData {
  hasHistory: boolean;
  totals: {
    documentsCount: number;
    notesCount: number;
    quizAttemptsCount: number;
    flashcardsTotal: number;
    flashcardsMastered: number;
    flashcardsDueToday: number;
    studyMinutesTotal: number;
    topicsTracked: number;
  };
  weakSubjects: Array<{ subject: string; avgScore: number | null; avgMastery: number | null; reason: string }>;
  strongSubjects: Array<{ subject: string; avgScore: number | null; avgMastery: number | null }>;
  difficultConcepts: Array<{ id: string; subject: string; topic: string; masteryLevel: number; struggleNotes?: string }>;
  frequentlyIncorrectAnswers: Array<{ subject: string; question: string }>;
  topicsRequiringRevision: Array<{ id: string; subject: string; topic: string; masteryLevel: number; nextReviewDate: string }>;
  recommendations: Array<{
    title: string;
    reason: string;
    actionLabel: string;
    targetTab: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  headlineInsight: string | null;
}

export interface LearningAnalyticsData {
  range: '7d' | '30d' | '90d' | 'all';
  summary: {
    totalStudyHours: number;
    totalStudyMinutes: number;
    sessionsCount: number;
    quizzesCompleted: number;
    avgQuizScore: number | null;
    totalCards: number;
    masteredCards: number;
    flashcardMasteryPercent: number | null;
    topicsTracked: number;
    revisionCompletionRate: number | null;
    streakDays: number;
  };
  dailyStudy: Array<{ date: string; minutes: number; sessionsCount: number }>;
  weeklyTotals: Array<{ weekStart: string; hours: number; sessionsCount: number }>;
  subjectPerformance: Array<{
    subject: string;
    avgQuizScore: number | null;
    quizAttempts: number;
    studyMinutes: number;
  }>;
  quizTrend: Array<{ attemptId: string; date: string; title: string; scorePercent: number }>;
  flashcardBreakdown: {
    totalCards: number;
    masteredCards: number;
    learningCards: number;
    unstudiedCards: number;
  };
  topicProgress: Array<{
    id: string;
    subject: string;
    topic: string;
    masteryLevel: number;
    status: string;
    difficultyLevel: string;
    nextReviewDate: string;
  }>;
  weakAreas: Array<{
    id: string;
    subject: string;
    topic: string;
    masteryLevel: number;
    status: string;
    difficultyLevel: string;
  }>;
}

export interface RevisionScheduleItem {
  id: string;
  sourceType: 'flashcard_deck' | 'topic_mastery' | 'quiz_weakness' | 'study_task';
  sourceId: string;
  title: string;
  subject: string;
  dueDate: string;
  bucket: 'overdue' | 'due_today' | 'upcoming' | 'completed';
  difficulty: string;
  masteryPercent: number;
  details: string;
  reschedulable: boolean;
}

export interface RevisionScheduleData {
  today: string;
  overdue: RevisionScheduleItem[];
  dueToday: RevisionScheduleItem[];
  upcoming: RevisionScheduleItem[];
  completed: RevisionScheduleItem[];
  counts: {
    overdue: number;
    dueToday: number;
    upcoming: number;
    completed: number;
  };
}
