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
  | 'history'
  | 'settings'
  | 'admin';

export interface SourceDocument {
  id: string;
  notebookId: string;
  title: string;
  type: 'pdf' | 'text' | 'markdown' | 'pasted' | 'url';
  content: string;
  fileSize?: string;
  addedAt: string;
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
  audioUrl?: string;
  isStreaming?: boolean;
}

export interface NoteItem {
  id: string;
  notebookId: string;
  title: string;
  content: string;
  updatedAt: string;
  tags: string[];
}

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  hint?: string;
  status?: 'unstudied' | 'learning' | 'mastered';
}

export interface FlashcardSet {
  id: string;
  notebookId: string;
  title: string;
  description: string;
  cards: Flashcard[];
  createdAt: string;
  category: string;
}

export interface QuizQuestion {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer';
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  sourceDocId?: string;
}

export interface QuizSet {
  id: string;
  notebookId: string;
  title: string;
  description: string;
  questions: QuizQuestion[];
  createdAt: string;
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

export interface HistoryLogItem {
  id: string;
  type: 'source_added' | 'quiz_completed' | 'flashcard_review' | 'ai_note_generated' | 'chat_query';
  title: string;
  details: string;
  timestamp: string;
  score?: string;
}

export interface UserProfile {
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
  documentsIndexed: number;
  systemHealth: 'Optimal' | 'Warning' | 'Maintenance';
}

