export interface FlashcardItemModel {
  id: string;
  question: string;
  answer: string;
  hint?: string;
  status?: 'unstudied' | 'learning' | 'mastered';
}

export interface FlashcardSetModel {
  id: string;
  notebookId?: string;
  title: string;
  description: string;
  cards: FlashcardItemModel[];
  createdAt: string;
  category: string;
}

export interface GenerateFlashcardsRequest {
  topic?: string;
  sourceContent?: string;
  cardCount?: number;
  notebookId?: string;
}
