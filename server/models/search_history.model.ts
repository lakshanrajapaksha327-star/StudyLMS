export interface SearchHistoryModel {
  id: string;
  userId: string;
  keyword: string;
  category?: 'documents' | 'flashcards' | 'quizzes' | 'notes' | 'chats' | 'all';
  resultCount?: number;
  createdAt: string;
}
