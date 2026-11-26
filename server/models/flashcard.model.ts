export interface FlashcardItemModel {
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

export interface FlashcardSetModel {
  id: string;
  userId?: string;
  notebookId: string;
  title: string;
  description: string;
  cards: FlashcardItemModel[];
  createdAt: string;
  updatedAt?: string;
  category: string;
}

export interface GenerateFlashcardsRequest {
  topic?: string;
  sourceContent?: string;
  cardCount?: number;
  notebookId?: string;
  selectedDocumentIds?: string[];
}
