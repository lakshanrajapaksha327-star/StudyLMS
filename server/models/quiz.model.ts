export interface QuizQuestionModel {
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

export interface QuizSourceCitationRef {
  documentId: string;
  documentTitle: string;
  chunkId: string;
  pageNumber?: number;
  slideNumber?: number;
}

export interface QuizSetModel {
  id: string;
  userId?: string;
  notebookId: string;
  title: string;
  description: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  questions: QuizQuestionModel[];
  createdAt: string;
  updatedAt?: string;
  bestScore?: number;
  groundingMode?: 'source_grounded' | 'general_knowledge';
  sourceDocumentIds?: string[];
  sourceCitations?: QuizSourceCitationRef[];
}

export interface GenerateQuizRequest {
  topic?: string;
  sourceContent?: string;
  sourceMode?: 'document' | 'note' | 'topic';
  questionCount?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  questionFormat?:
    | 'mixed'
    | 'multiple-choice'
    | 'true-false'
    | 'short-answer'
    | 'fill-in-the-blank'
    | 'matching'
    | 'scenario';
  notebookId?: string;
  selectedDocumentIds?: string[];
}
