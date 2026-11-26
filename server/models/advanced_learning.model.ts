export interface StudySessionModel {
  id: string;
  userId: string;
  notebookId?: string;
  subject: string;
  activityType?: 'reading' | 'flashcards' | 'quiz' | 'notes' | 'exam_prep' | 'adaptive_tutor' | 'general';
  startedAt: string;
  endedAt: string;
  activeDurationSeconds: number;
  pausedSeconds?: number;
  notes?: string;
  createdAt: string;
}

export interface DiagramNodeModel {
  id: string;
  label: string;
  category: string;
  x: number;
  y: number;
  notes?: string;
}

export interface DiagramEdgeModel {
  id: string;
  from: string;
  to: string;
  label?: string;
}

export interface VisualDiagramModel {
  id: string;
  userId: string;
  notebookId: string;
  title: string;
  diagramType: string;
  description?: string;
  nodes: DiagramNodeModel[];
  edges: DiagramEdgeModel[];
  mermaidSyntax?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExamPrepGuideModel {
  id: string;
  userId: string;
  notebookId: string;
  subject: string;
  examDate: string;
  syllabusSummary?: string;
  topicPlan?: Array<{ topic: string; priority: string; estimatedHours: number; rationale: string }>;
  importantConcepts?: Array<{ concept: string; explanation: string; sourceHint?: string }>;
  recurringThemes?: string[];
  likelyTopics?: Array<{ topic: string; likelihood: string; evidenceBasis: string; uncertaintyNote: string }>;
  practiceQuestions?: Array<{
    question: string;
    marks: number;
    difficulty: string;
    modelAnswer: string;
    markingRubric?: string;
  }>;
  formulaSheet?: Array<{ name: string; expression: string; whenToUse?: string }>;
  revisionChecklist?: Array<{ id: string; item: string; completed: boolean }>;
  mockExamQuestions?: Array<{
    id: string;
    type: string;
    question: string;
    options?: string[];
    correctAnswer: string;
    explanation: string;
  }>;
  evidenceSources?: string[];
  uncertaintyNotice?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TopicMasteryModel {
  id: string;
  userId: string;
  notebookId?: string;
  subject: string;
  topic: string;
  masteryLevel: number;
  difficultyLevel: 'foundational' | 'intermediate' | 'advanced';
  status: 'struggling' | 'learning' | 'proficient' | 'mastered';
  attemptsCount?: number;
  correctCount?: number;
  lastReviewedAt?: string;
  nextReviewDate: string;
  struggleNotes?: string;
  createdAt?: string;
  updatedAt: string;
}

export interface AudioLectureModel {
  id: string;
  userId: string;
  notebookId: string;
  title: string;
  originalFilename?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  durationSeconds?: number;
  transcriptText: string;
  transcriptSegments?: Array<{ timestamp: string; speaker?: string; text: string }>;
  speakerNotesAvailable?: boolean;
  speakerNotesNotice?: string;
  summary?: string;
  keyConcepts?: string[];
  flashcards?: Array<{ question: string; answer: string; hint?: string }>;
  quizQuestions?: Array<{
    id: string;
    type: string;
    question: string;
    options?: string[];
    correctAnswer: string;
    explanation: string;
  }>;
  revisionNotes?: string;
  createdAt: string;
}
