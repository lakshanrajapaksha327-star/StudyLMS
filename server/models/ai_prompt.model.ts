export interface AiPromptLogModel {
  id: string;
  userId: string;
  feature:
    | 'chat'
    | 'document_summary'
    | 'flashcards'
    | 'quiz'
    | 'study_planner'
    | 'notion_ai'
    | 'speech'
    | 'ocr'
    | 'embeddings';
  provider?: 'gemini' | 'openai' | 'anthropic';
  prompt: string;
  response: string;
  latencyMs: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  costUsd: number;
  tokensConsumed: number;
  modelName: string;
  status?: 'success' | 'fallback_success' | 'cached' | 'error';
  errorCategory?: string;
  cached?: boolean;
  fallbackUsed?: boolean;
  createdAt: string;
}
