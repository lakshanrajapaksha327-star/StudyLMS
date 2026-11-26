export interface UserProfileDoc {
  uid: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'Student' | 'Educator' | 'Admin';
  studyGoalMinutes?: number;
  streakDays?: number;
  cardsMastered?: number;
  quizzesCompleted?: number;
  timeSpentMinutes?: number;
  status?: 'Active' | 'Suspended';
  createdAt: string;
  updatedAt: string;
}

export interface NotebookModel {
  id: string;
  userId: string;
  title: string;
  description?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudyNoteModel {
  id: string;
  userId: string;
  notebookId: string;
  title: string;
  content: string;
  tags?: string[];
  aiGenerated?: boolean;
  createdAt?: string;
  updatedAt: string;
}

export interface NoteVersionModel {
  id: string;
  userId: string;
  noteId: string;
  title: string;
  content: string;
  savedAt: string;
}

export interface StudyTaskModel {
  id: string;
  userId: string;
  title: string;
  subject?: string;
  scheduledDate?: string;
  durationMinutes?: number;
  completed: boolean;
  priority?: 'low' | 'medium' | 'high';
  taskType?: string;
  createdAt: string;
}

export interface NotificationModel {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'reminder' | 'exam' | 'flashcard' | 'streak' | 'document';
  read: boolean;
  createdAt: string;
}

export interface QuizAttemptModel {
  id: string;
  userId: string;
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

export interface DocumentAnnotationModel {
  id: string;
  userId: string;
  documentId: string;
  notebookId: string;
  pageNumber?: number;
  content: string;
  type: 'sticky_note' | 'highlight' | 'bookmark';
  createdAt: string;
  updatedAt?: string;
}

export interface ActivityLogModel {
  id: string;
  userId: string;
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
  details?: string;
  score?: string;
  timestamp?: string;
  createdAt: string;
}
