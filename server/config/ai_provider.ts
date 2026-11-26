import { ZodType } from 'zod';
import { aiManagerService, stripMarkdownJsonFences } from '../ai/ai-manager.service';
import { modelRegistry } from '../ai/model-registry';
import { pcmBase64ToWavBase64 } from '../ai/providers/gemini.provider';
import { AuthContext } from '../repositories/base.repository';

export const DEFAULT_TEXT_MODEL = modelRegistry.resolveModelForProvider('gemini', 'complex_reasoning');
export const FALLBACK_TEXT_MODEL = modelRegistry.resolveModelForProvider('gemini', 'simple_text');
export const DEFAULT_EMBEDDING_MODEL = modelRegistry.resolveModelForProvider('gemini', 'embeddings');
export const DEFAULT_TTS_MODEL = modelRegistry.resolveModelForProvider('gemini', 'tts');

export { stripMarkdownJsonFences, pcmBase64ToWavBase64 };

export function resolveSupportedGeminiModel(preferred?: string): string {
  return modelRegistry.resolveModelForProvider('gemini', 'complex_reasoning', preferred);
}

export async function generateContentWithRetry(params: {
  model?: string;
  contents: any;
  config?: Record<string, any>;
  feature: string;
  promptSummary?: string;
  auth?: AuthContext;
  taskType?: 'simple_text' | 'complex_reasoning' | 'multimodal' | 'structured_json';
  cacheable?: boolean;
}) {
  const managed = await aiManagerService.generate({
    taskType: params.taskType || (params.config?.responseMimeType === 'application/json' ? 'structured_json' : 'complex_reasoning'),
    feature: params.feature as any,
    contents: params.contents,
    preferredModel: params.model,
    promptSummary: params.promptSummary,
    auth: params.auth,
    responseMimeType: params.config?.responseMimeType,
    geminiResponseSchema: params.config?.responseSchema,
    systemInstruction: params.config?.systemInstruction,
    cacheable: params.cacheable,
  });

  return {
    response: { text: managed.text },
    model: managed.model,
    provider: managed.provider,
    latencyMs: managed.latencyMs,
    totalTokens: managed.usage.totalTokens ?? 0,
    meta: managed,
  };
}

export function parseGeminiJson<T>(rawText: string | undefined, schema: ZodType<T>): T {
  const cleaned = stripMarkdownJsonFences(rawText || '{}');
  const parsed = JSON.parse(cleaned);
  return schema.parse(parsed);
}

export async function embedTexts(
  texts: string[],
  taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' = 'RETRIEVAL_DOCUMENT'
) {
  return aiManagerService.embedTexts(texts, taskType);
}
