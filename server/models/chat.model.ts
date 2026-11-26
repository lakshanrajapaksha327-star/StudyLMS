export interface ChatMessageCitation {
  documentId: string;
  documentTitle: string;
  pageNumber?: number;
  slideNumber?: number;
  sectionHeading?: string;
  excerpt: string;
  score?: number;
}

export interface ChatMessageModel {
  id: string;
  sessionId?: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  sourcesUsed?: string[];
  suggestedQuestions?: string[];
  citations?: ChatMessageCitation[];
  tokensConsumed?: number;
}

export interface ChatSessionModel {
  id: string;
  userId?: string;
  title: string;
  notebookId?: string;
  persona: 'Standard Tutor' | 'Socratic Tutor' | 'Exam Coach' | 'Simplified Explainer';
  isArchived?: boolean;
  messages: ChatMessageModel[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatRequest {
  messages: ChatMessageModel[];
  sources?: Array<{
    id?: string;
    title: string;
    content: string;
  }>;
  selectedDocumentIds?: string[];
  notebookId?: string;
  notebookTitle?: string;
  persona?: string;
  sessionId?: string;
  strictGrounded?: boolean;
}

export interface ChatResponse {
  text: string;
  suggestedQuestions: string[];
  sourcesUsed: string[];
  citations: ChatMessageCitation[];
  sessionId?: string;
  grounded?: boolean;
}
