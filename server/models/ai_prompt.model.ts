export interface AiPromptLogModel {
  id: string;
  userId: string;
  feature: 'chat' | 'document_summary' | 'flashcards' | 'quiz' | 'study_planner' | 'notion_ai' | 'speech';
  prompt: string;
  response: string;
  latencyMs: number;
  costUsd: number;
  tokensConsumed: number;
  modelName: string;
  createdAt: string;
}
