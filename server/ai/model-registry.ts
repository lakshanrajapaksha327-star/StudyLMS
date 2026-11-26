import { AiProviderId, AiTaskType } from './ai-provider.interface';

export interface ModelConfigProfile {
  simpleText: string;
  complexReasoning: string;
  multimodal: string;
  structuredJson: string;
  embeddings?: string;
  tts?: string;
  audioTranscription?: string;
}

const VALID_GEMINI_TEXT_MODELS = new Set([
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
  'gemini-4-neon',
  'gemini-4-carbon',
  'gemini-4-argon',
  'gemini-3-flash',
]);

export function sanitizeGeminiModelId(candidate?: string): string {
  if (!candidate) return 'gemini-4-hydrogen';
  const normalized = candidate.trim().toLowerCase();
  if (VALID_GEMINI_TEXT_MODELS.has(normalized)) return normalized;
  if (normalized.includes('3.1-flash-lite') || normalized.includes('lite')) {
    return 'gemini-3.1-flash-lite';
  }
  if (normalized.includes('hydrogen') || normalized.includes('flash')) {
    return 'gemini-4-hydrogen';
  }
  if (normalized.includes('neon')) return 'gemini-4-neon';
  if (normalized.includes('carbon')) return 'gemini-4-carbon';
  return 'gemini-4-hydrogen';
}

export class ModelRegistry {
  public getPrimaryProviderId(): AiProviderId {
    const raw = (process.env.AI_PRIMARY_PROVIDER || 'gemini').trim().toLowerCase();
    if (raw === 'openai' || raw === 'anthropic' || raw === 'gemini') return raw;
    return 'gemini';
  }

  public getFallbackProviderId(): AiProviderId {
    const raw = (process.env.AI_FALLBACK_PROVIDER || 'openai').trim().toLowerCase();
    if (raw === 'openai' || raw === 'anthropic' || raw === 'gemini') return raw;
    return 'openai';
  }

  public getGeminiProfile(): ModelConfigProfile {
    const envModel = process.env.GEMINI_MODEL ? sanitizeGeminiModelId(process.env.GEMINI_MODEL) : undefined;
    return {
      simpleText: envModel || 'gemini-3.1-flash-lite',
      complexReasoning: envModel || 'gemini-4-hydrogen',
      multimodal: envModel || 'gemini-4-hydrogen',
      structuredJson: envModel || 'gemini-4-hydrogen',
      embeddings: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2',
      tts: process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-lite-tts',
      audioTranscription: process.env.GEMINI_TRANSCRIBE_MODEL || 'gemini-3.5-transcribe',
    };
  }

  public getOpenAiProfile(): ModelConfigProfile {
    const envModel = process.env.OPENAI_MODEL?.trim();
    return {
      simpleText: envModel || 'gpt-4o-mini',
      complexReasoning: envModel || 'gpt-4o',
      multimodal: envModel || 'gpt-4o',
      structuredJson: envModel || 'gpt-4o-mini',
      embeddings: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
      tts: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
    };
  }

  public getAnthropicProfile(): ModelConfigProfile {
    const envModel = process.env.ANTHROPIC_MODEL?.trim();
    return {
      simpleText: envModel || 'claude-3-5-haiku-latest',
      complexReasoning: envModel || 'claude-3-7-sonnet-latest',
      multimodal: envModel || 'claude-3-7-sonnet-latest',
      structuredJson: envModel || 'claude-3-5-haiku-latest',
    };
  }

  public resolveModelForProvider(
    provider: AiProviderId,
    taskType: AiTaskType,
    preferredModel?: string
  ): string {
    if (provider === 'gemini') {
      const profile = this.getGeminiProfile();
      if (preferredModel) return sanitizeGeminiModelId(preferredModel);
      switch (taskType) {
        case 'simple_text':
          return profile.simpleText;
        case 'complex_reasoning':
          return profile.complexReasoning;
        case 'multimodal':
          return profile.multimodal;
        case 'structured_json':
          return profile.structuredJson;
        case 'embeddings':
          return profile.embeddings || 'gemini-embedding-2';
        case 'tts':
          return profile.tts || 'gemini-3.8-flash-lite-tts';
        case 'audio_transcription':
          return profile.audioTranscription || 'gemini-3.5-transcribe';
      }
    }

    if (provider === 'openai') {
      const profile = this.getOpenAiProfile();
      switch (taskType) {
        case 'simple_text':
          return profile.simpleText;
        case 'complex_reasoning':
          return profile.complexReasoning;
        case 'multimodal':
          return profile.multimodal;
        case 'structured_json':
          return profile.structuredJson;
        case 'embeddings':
          return profile.embeddings || 'text-embedding-3-small';
        case 'tts':
          return profile.tts || 'gpt-4o-mini-tts';
        case 'audio_transcription':
          return 'unsupported';
      }
    }

    const profile = this.getAnthropicProfile();
    switch (taskType) {
      case 'complex_reasoning':
        return profile.complexReasoning;
      case 'multimodal':
        return profile.multimodal;
      case 'simple_text':
      case 'structured_json':
      default:
        return profile.simpleText;
    }
  }
}

export const modelRegistry = new ModelRegistry();
