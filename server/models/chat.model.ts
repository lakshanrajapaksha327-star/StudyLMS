export interface ChatMessageModel {
  id: string;
  sessionId?: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  sourcesUsed?: string[];
  suggestedQuestions?: string[];
  citations?: string[];
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
  notebookTitle?: string;
  persona?: string;
  sessionId?: string;
}

export interface ChatResponse {
  text: string;
  suggestedQuestions: string[];
  sourcesUsed: string[];
  citations?: string[];
  sessionId?: string;
}

