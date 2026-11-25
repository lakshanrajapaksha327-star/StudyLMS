export interface QuizQuestionModel {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer';
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
}

export interface QuizSetModel {
  id: string;
  notebookId?: string;
  title: string;
  description: string;
  questions: QuizQuestionModel[];
  createdAt: string;
  bestScore?: number;
}

export interface GenerateQuizRequest {
  topic?: string;
  sourceContent?: string;
  questionCount?: number;
  notebookId?: string;
}
