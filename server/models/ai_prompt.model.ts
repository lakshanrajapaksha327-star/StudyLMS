export interface AiPromptLogModel {
  id: string;
  userId: string;
  feature: string;
  provider?: 'gemini' | 'openai' | 'anthropic';
  prompt?: string;
  response?: string;
  latencyMs: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  costUsd?: number | null;
  tokensConsumed: number;
  modelName: string;
  status?: 'success' | 'fallback_success' | 'cached' | 'error';
  errorCategory?: string;
  cached?: boolean;
  fallbackUsed?: boolean;
  createdAt: string;
}

