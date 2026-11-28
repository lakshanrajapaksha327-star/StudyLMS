import { AiServiceError } from './ai-errors';
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

const VALID_GEMINI_MODELS = new Set([
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
  'gemini-4-neon',
  'gemini-4-carbon',
  'gemini-4-argon',
  'gemini-3-flash',
  'gemini-3-pro',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-embedding-2',
  'gemini-3.8-flash-lite-tts',
  'gemini-3.8-flash-tts',
  'gemini-3.5-transcribe',
  'gemini-3.1-flash-lite-image',
  'gemini-nano-banana-2.1',
  'gemini-3-pro-image',
]);

const GEMINI_ALIASES: Record<string, string> = {
  'gemini flash': 'gemini-4-hydrogen',
  'gemini 4 flash': 'gemini-4-hydrogen',
  'gemini hydrogen': 'gemini-4-hydrogen',
  'gemini 4 hydrogen': 'gemini-4-hydrogen',
  'gemini lite': 'gemini-3.1-flash-lite',
  'flash lite': 'gemini-3.1-flash-lite',
  'gemini carbon': 'gemini-4-carbon',
  'gemini 4 carbon': 'gemini-4-carbon',
  'gemini neon': 'gemini-4-neon',
  'gemini 4 neon': 'gemini-4-neon',
  'gemini argon': 'gemini-4-argon',
  'gemini 4 argon': 'gemini-4-argon',
  'gemini 4': 'gemini-4-neon',
};

const DEPRECATED_GEMINI_PATTERN = /^gemini-(?:1\.0|1\.5|2\.0)(?:-|$)/i;
const VERSIONED_GEMINI_PATTERN = /^gemini-(?:2\.5|3(?:\.\d+)?|4)(?:-[a-z0-9.]+)+$/i;

export function validateGeminiModelId(candidate: string): string {
  const trimmed = candidate.trim();
  if (!trimmed) {
    throw new AiServiceError({
      message: 'Gemini model ID cannot be empty.',
      statusCode: 400,
      category: 'invalid_request',
      retryable: false,
      switchProviderAllowed: false,
      provider: 'gemini',
    });
  }

  const normalized = trimmed.toLowerCase();
  if (DEPRECATED_GEMINI_PATTERN.test(normalized) || normalized === 'gemini-pro') {
    throw new AiServiceError({
      message: `Deprecated or unsupported Gemini model "${candidate}". Use a supported Gemini 3/4 model such as gemini-4-hydrogen or gemini-3.1-flash-lite.`,
      statusCode: 400,
      category: 'invalid_request',
      retryable: false,
      switchProviderAllowed: false,
      provider: 'gemini',
    });
  }

  if (GEMINI_ALIASES[normalized]) {
    return GEMINI_ALIASES[normalized];
  }

  if (VALID_GEMINI_MODELS.has(normalized) || VERSIONED_GEMINI_PATTERN.test(normalized)) {
    return normalized;
  }

  throw new AiServiceError({
    message: `Invalid or unrecognized Gemini model "${candidate}". Supported defaults include gemini-4-hydrogen and gemini-3.1-flash-lite.`,
    statusCode: 400,
    category: 'invalid_request',
    retryable: false,
    switchProviderAllowed: false,
    provider: 'gemini',
  });
}

export function sanitizeGeminiModelId(candidate?: string): string {
  if (!candidate || !candidate.trim()) return 'gemini-4-hydrogen';
  return validateGeminiModelId(candidate);
}

export function validateOpenAiModelId(candidate: string): string {
  const trimmed = candidate.trim();
  if (!trimmed || !/^(?:gpt-|o[1-9]|text-embedding-|whisper-|chatgpt-)[a-z0-9._-]+$/i.test(trimmed)) {
    throw new AiServiceError({
      message: `Invalid or unrecognized OpenAI model "${candidate}".`,
      statusCode: 400,
      category: 'invalid_request',
      retryable: false,
      switchProviderAllowed: false,
      provider: 'openai',
    });
  }
  return trimmed;
}

export function validateAnthropicModelId(candidate: string): string {
  const trimmed = candidate.trim();
  if (
    !trimmed ||
    !/^claude-[a-z0-9.-]+$/i.test(trimmed) ||
    /^claude-3-(?:5|7)-/i.test(trimmed)
  ) {
    throw new AiServiceError({
      message: `Invalid or deprecated Anthropic model "${candidate}". Use a supported Claude 4.5 model such as claude-sonnet-4-5 or claude-haiku-4-5.`,
      statusCode: 400,
      category: 'invalid_request',
      retryable: false,
      switchProviderAllowed: false,
      provider: 'anthropic',
    });
  }
  return trimmed;
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

  public getCanonicalEmbeddingProvider(): AiProviderId {
    const raw = (process.env.AI_EMBEDDING_PROVIDER || 'gemini').trim().toLowerCase();
    if (raw === 'gemini' || raw === 'openai') return raw;
    return 'gemini';
  }

  public getCanonicalEmbeddingConfig(): { provider: 'gemini' | 'openai'; model: string } {
    const provider = this.getCanonicalEmbeddingProvider() === 'openai' ? 'openai' : 'gemini';
    const model = this.resolveModelForProvider(provider, 'embeddings');
    return { provider, model };
  }

  private resolveGeminiEnv(envValue: string | undefined, fallback: string): string {
    if (!envValue || !envValue.trim()) return fallback;
    return validateGeminiModelId(envValue);
  }

  public getGeminiProfile(): ModelConfigProfile {
    return {
      simpleText: this.resolveGeminiEnv(process.env.GEMINI_SIMPLE_MODEL, 'gemini-3.1-flash-lite'),
      complexReasoning: this.resolveGeminiEnv(process.env.GEMINI_COMPLEX_MODEL, 'gemini-4-hydrogen'),
      multimodal: this.resolveGeminiEnv(process.env.GEMINI_MULTIMODAL_MODEL, 'gemini-4-hydrogen'),
      structuredJson: this.resolveGeminiEnv(process.env.GEMINI_STRUCTURED_MODEL, 'gemini-4-hydrogen'),
      embeddings: this.resolveGeminiEnv(process.env.GEMINI_EMBEDDING_MODEL, 'gemini-embedding-2'),
      tts: this.resolveGeminiEnv(process.env.GEMINI_TTS_MODEL, 'gemini-3.8-flash-lite-tts'),
      audioTranscription: this.resolveGeminiEnv(
        process.env.GEMINI_TRANSCRIBE_MODEL,
        'gemini-3.5-transcribe'
      ),
    };
  }

  public getOpenAiProfile(): ModelConfigProfile {
    const resolve = (val: string | undefined, def: string) =>
      val && val.trim() ? validateOpenAiModelId(val) : def;
    return {
      simpleText: resolve(process.env.OPENAI_SIMPLE_MODEL, 'gpt-4o-mini'),
      complexReasoning: resolve(process.env.OPENAI_COMPLEX_MODEL, 'gpt-4o'),
      multimodal: resolve(process.env.OPENAI_MULTIMODAL_MODEL, 'gpt-4o'),
      structuredJson: resolve(process.env.OPENAI_STRUCTURED_MODEL, 'gpt-4o-mini'),
      embeddings: resolve(process.env.OPENAI_EMBEDDING_MODEL, 'text-embedding-3-small'),
      tts: resolve(process.env.OPENAI_TTS_MODEL, 'gpt-4o-mini-tts'),
      audioTranscription: resolve(process.env.OPENAI_TRANSCRIBE_MODEL, 'gpt-4o-mini-transcribe'),
    };
  }

  public getAnthropicProfile(): ModelConfigProfile {
    const resolve = (val: string | undefined, def: string) =>
      val && val.trim() ? validateAnthropicModelId(val) : def;
    return {
      simpleText: resolve(process.env.ANTHROPIC_SIMPLE_MODEL, 'claude-haiku-4-5'),
      complexReasoning: resolve(process.env.ANTHROPIC_COMPLEX_MODEL, 'claude-sonnet-4-5'),
      multimodal: resolve(process.env.ANTHROPIC_MULTIMODAL_MODEL, 'claude-sonnet-4-5'),
      structuredJson: resolve(process.env.ANTHROPIC_STRUCTURED_MODEL, 'claude-haiku-4-5'),
    };
  }

  public resolveModelForProvider(
    provider: AiProviderId,
    taskType: AiTaskType,
    preferredModel?: string
  ): string {
    if (provider === 'gemini') {
      const profile = this.getGeminiProfile();
      if (preferredModel) return validateGeminiModelId(preferredModel);
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
      if (preferredModel) return validateOpenAiModelId(preferredModel);
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
          return profile.audioTranscription || 'gpt-4o-mini-transcribe';
      }
    }

    const profile = this.getAnthropicProfile();
    if (preferredModel) return validateAnthropicModelId(preferredModel);
    switch (taskType) {
      case 'complex_reasoning':
        return profile.complexReasoning;
      case 'multimodal':
        return profile.multimodal;
      case 'structured_json':
        return profile.structuredJson;
      case 'simple_text':
      default:
        return profile.simpleText;
    }
  }
}

export const modelRegistry = new ModelRegistry();
