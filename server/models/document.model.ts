export interface DocumentModel {
  id: string;
  notebookId?: string;
  title: string;
  type: 'pdf' | 'text' | 'markdown' | 'pasted' | 'url';
  content: string;
  summary: string;
  keyConcepts: string[];
  fileSize?: string;
  addedAt: string;
}

export interface DocumentSummaryResult {
  summary: string;
  keyConcepts: string[];
  flashcards?: Array<{
    question: string;
    answer: string;
    hint?: string;
  }>;
}
