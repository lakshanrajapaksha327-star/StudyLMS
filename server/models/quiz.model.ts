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
}

export interface GenerateQuizRequest {
  topic?: string;
  sourceContent?: string;
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
