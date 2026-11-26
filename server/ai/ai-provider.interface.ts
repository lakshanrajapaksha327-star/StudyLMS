import { AiErrorCategory, AiProviderId } from './ai-errors';
import { AuthContext } from '../repositories/base.repository';

export type { AiErrorCategory, AiProviderId };

export type AiTaskType =
  | 'simple_text'
  | 'complex_reasoning'
  | 'multimodal'
  | 'structured_json'
  | 'embeddings'
  | 'tts'
  | 'audio_transcription';

export type AiFeatureName =
  | 'chat'
  | 'document_summary'
  | 'flashcards'
  | 'quiz'
  | 'study_planner'
  | 'notion_ai'
  | 'speech'
  | 'audio_lecture'
  | 'adaptive_tutor'
  | 'personalized_insights'
  | 'exam_prep'
  | 'multi_doc_synthesis'
  | 'formula_solver'
  | 'code_explainer'
  | 'exam_predictor'
  | 'citations'
  | 'diagram'
  | 'slides'
  | 'cheat_sheet'
  | 'mnemonics'
  | 'viva'
  | 'ocr';

export interface AiInlinePart {
  mimeType: string;
  dataBase64: string;
}

export interface AiGenerateRequest {
  taskType: AiTaskType;
  feature: AiFeatureName | string;
  promptSummary?: string;
  systemInstruction?: string;
  contents: string | Array<{ role?: string; parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }> | { parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> };
  preferredModel?: string;
  responseMimeType?: 'application/json' | 'text/plain';
  geminiResponseSchema?: Record<string, any>;
  jsonSchemaDescription?: string;
  cacheable?: boolean;
  cacheTtlMs?: number;
  timeoutMs?: number;
  auth?: AuthContext;
  signal?: AbortSignal;
}

export interface AiUsageMetrics {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  /**
   * Real cost only when official per-token pricing applies; null when unknown/unbilled.
   */
  actualCostUsd: number | null;
}

export interface AiProviderExecutionResult {
  text: string;
  provider: AiProviderId;
  model: string;
  latencyMs: number;
  usage: AiUsageMetrics;
  finishReason?: string;
}

export interface AiManagedResponse extends AiProviderExecutionResult {
  cached: boolean;
  fallbackUsed: boolean;
  attempts: number;
}

export interface AiEmbeddingResult {
  vectors: number[][];
  model: string;
  dimension: number;
  provider: AiProviderId;
  latencyMs: number;
  usage: AiUsageMetrics;
}

export interface AiSpeechResult {
  audioBase64: string;
  mimeType: string;
  model: string;
  provider: AiProviderId;
  latencyMs: number;
}

export interface AiProviderHealthSnapshot {
  id: AiProviderId;
  displayName: string;
  configured: boolean;
  available: boolean;
  configuredModel: string;
  status: 'healthy' | 'degraded' | 'open_circuit' | 'unavailable';
  circuitState: 'closed' | 'open' | 'half_open';
  cooldownRemainingMs: number;
  lastLatencyMs: number | null;
  recentFailureRate: number;
  totalRequests: number;
  totalFailures: number;
  lastErrorCategory: AiErrorCategory | null;
  lastCheckedAt: string | null;
}

export interface AiProviderAdapter {
  readonly id: AiProviderId;
  readonly displayName: string;
  isConfigured(): boolean;
  supportsTask(taskType: AiTaskType): boolean;
  getConfiguredModel(taskType: AiTaskType, preferredModel?: string): string;
  generateText(req: AiGenerateRequest, model: string, signal?: AbortSignal): Promise<AiProviderExecutionResult>;
  embedTexts?(texts: string[], taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'): Promise<AiEmbeddingResult>;
  generateSpeech?(text: string, voice?: string): Promise<AiSpeechResult>;
  transcribeAudio?(audioBase64: string, mimeType: string, prompt?: string, signal?: AbortSignal): Promise<AiProviderExecutionResult>;
}
