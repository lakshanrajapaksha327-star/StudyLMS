import OpenAI, { toFile } from 'openai';
import {
  AiEmbeddingResult,
  AiGenerateRequest,
  AiProviderAdapter,
  AiProviderExecutionResult,
  AiSpeechResult,
  AiTaskType,
} from '../ai-provider.interface';
import { AiServiceError, classifyProviderError } from '../ai-errors';
import { modelRegistry } from '../model-registry';

const OPENAI_RASTER_IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
]);

function mimeTypeToAudioExtension(mimeType: string): string {
  const lower = (mimeType || '').toLowerCase();
  if (lower.includes('wav')) return 'wav';
  if (lower.includes('mpeg') || lower.includes('mp3')) return 'mp3';
  if (lower.includes('mp4') || lower.includes('m4a')) return 'm4a';
  if (lower.includes('ogg')) return 'ogg';
  if (lower.includes('flac')) return 'flac';
  return 'webm';
}

export function convertContentsToOpenAiMessages(
  contents: AiGenerateRequest['contents'],
  systemInstruction?: string,
  requireJson?: boolean,
  jsonSchemaDescription?: string
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

  const systemParts: string[] = [];
  if (systemInstruction) systemParts.push(systemInstruction);
  if (requireJson) {
    systemParts.push('Return ONLY valid JSON matching the requested schema without markdown fences.');
    if (jsonSchemaDescription) {
      systemParts.push(`Expected JSON shape:\n${jsonSchemaDescription}`);
    }
  }
  if (systemParts.length > 0) {
    messages.push({ role: 'system', content: systemParts.join('\n\n') });
  }

  if (typeof contents === 'string') {
    messages.push({ role: 'user', content: contents });
    return messages;
  }

  const contentArray = Array.isArray(contents) ? contents : [{ role: 'user', parts: contents.parts }];

  for (const item of contentArray) {
    const role = item.role === 'model' || item.role === 'assistant' ? 'assistant' : 'user';
    const hasInline = item.parts.some((p) => Boolean(p.inlineData));

    if (!hasInline) {
      const joined = item.parts.map((p) => p.text || '').join('\n').trim();
      if (joined) {
        messages.push({ role, content: joined });
      }
    } else {
      const parts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];
      for (const p of item.parts) {
        if (p.text) {
          parts.push({ type: 'text', text: p.text });
        } else if (p.inlineData) {
          const mime = (p.inlineData.mimeType || '').toLowerCase();
          if (!OPENAI_RASTER_IMAGE_MIMES.has(mime)) {
            throw new AiServiceError({
              message: `OpenAI Chat Completions cannot ingest binary MIME type "${p.inlineData.mimeType}" as an image URL. Use Gemini or Anthropic for PDFs/audio documents.`,
              statusCode: 422,
              category: 'invalid_request',
              retryable: false,
              switchProviderAllowed: true,
              provider: 'openai',
            });
          }
          parts.push({
            type: 'image_url',
            image_url: {
              url: `data:${mime};base64,${p.inlineData.data}`,
            },
          });
        }
      }
      if (parts.length > 0) {
        messages.push({ role: 'user', content: parts });
      }
    }
  }

  return messages;
}

export class OpenAiProvider implements AiProviderAdapter {
  public readonly id = 'openai' as const;
  public readonly displayName = 'OpenAI (Fallback Provider)';

  public isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY?.trim());
  }

  public supportsTask(_taskType: AiTaskType): boolean {
    return true;
  }

  public getConfiguredModel(taskType: AiTaskType): string {
    return modelRegistry.resolveModelForProvider('openai', taskType);
  }

  private getClient(): OpenAI {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new AiServiceError({
        message: 'OPENAI_API_KEY environment variable is not configured.',
        statusCode: 503,
        category: 'provider_unavailable',
        retryable: false,
        switchProviderAllowed: true,
        provider: 'openai',
      });
    }
    return new OpenAI({ apiKey });
  }

  public async generateText(
    req: AiGenerateRequest,
    model: string,
    signal?: AbortSignal
  ): Promise<AiProviderExecutionResult> {
    const client = this.getClient();
    const startTime = Date.now();
    const requireJson = req.responseMimeType === 'application/json';
    const messages = convertContentsToOpenAiMessages(
      req.contents,
      req.systemInstruction,
      requireJson,
      req.jsonSchemaDescription
    );

    try {
      const completion = await client.chat.completions.create(
        {
          model,
          messages,
          ...(requireJson ? { response_format: { type: 'json_object' } } : {}),
        },
        signal ? { signal } : undefined
      );

      const latencyMs = Date.now() - startTime;
      const choice = completion.choices?.[0];
      const text = choice?.message?.content || '';

      return {
        text,
        provider: 'openai',
        model: completion.model || model,
        latencyMs,
        usage: {
          inputTokens: typeof completion.usage?.prompt_tokens === 'number' ? completion.usage.prompt_tokens : null,
          outputTokens:
            typeof completion.usage?.completion_tokens === 'number' ? completion.usage.completion_tokens : null,
          totalTokens: typeof completion.usage?.total_tokens === 'number' ? completion.usage.total_tokens : null,
          actualCostUsd: null,
        },
        finishReason: choice?.finish_reason || undefined,
      };
    } catch (err) {
      throw classifyProviderError(err, 'openai');
    }
  }

  public async embedTexts(texts: string[]): Promise<AiEmbeddingResult> {
    const model = this.getConfiguredModel('embeddings');
    if (texts.length === 0) {
      return {
        vectors: [],
        model,
        dimension: 768,
        provider: 'openai',
        latencyMs: 0,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, actualCostUsd: null },
      };
    }

    const client = this.getClient();
    const startTime = Date.now();
    try {
      const res = await client.embeddings.create({
        model,
        input: texts.map((t) => t.slice(0, 8000)),
        dimensions: 768,
      });

      const vectors = res.data.map((d) => d.embedding);
      return {
        vectors,
        model,
        dimension: vectors[0]?.length || 768,
        provider: 'openai',
        latencyMs: Date.now() - startTime,
        usage: {
          inputTokens: typeof res.usage?.prompt_tokens === 'number' ? res.usage.prompt_tokens : null,
          outputTokens: 0,
          totalTokens: typeof res.usage?.total_tokens === 'number' ? res.usage.total_tokens : null,
          actualCostUsd: null,
        },
      };
    } catch (err) {
      throw classifyProviderError(err, 'openai');
    }
  }

  public async generateSpeech(text: string): Promise<AiSpeechResult> {
    const client = this.getClient();
    const model = this.getConfiguredModel('tts');
    const startTime = Date.now();
    try {
      const mp3 = await client.audio.speech.create({
        model,
        voice: 'alloy',
        input: text.slice(0, 1200),
        response_format: 'wav',
      });
      const arrayBuf = await mp3.arrayBuffer();
      return {
        audioBase64: Buffer.from(arrayBuf).toString('base64'),
        mimeType: 'audio/wav',
        model,
        provider: 'openai',
        latencyMs: Date.now() - startTime,
      };
    } catch (err) {
      throw classifyProviderError(err, 'openai');
    }
  }

  public async transcribeAudio(
    audioBase64: string,
    mimeType: string,
    prompt?: string,
    signal?: AbortSignal
  ): Promise<AiProviderExecutionResult> {
    const client = this.getClient();
    const model = this.getConfiguredModel('audio_transcription');
    const startTime = Date.now();
    try {
      const buffer = Buffer.from(audioBase64, 'base64');
      const ext = mimeTypeToAudioExtension(mimeType);
      const file = await toFile(buffer, `lecture.${ext}`, {
        type: mimeType || 'audio/webm',
      });

      const transcription = await client.audio.transcriptions.create(
        {
          file,
          model,
          ...(prompt ? { prompt: prompt.slice(0, 500) } : {}),
        },
        signal ? { signal } : undefined
      );

      const text = typeof transcription === 'string' ? transcription : transcription.text || '';
      return {
        text,
        provider: 'openai',
        model,
        latencyMs: Date.now() - startTime,
        usage: {
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
          actualCostUsd: null,
        },
      };
    } catch (err) {
      throw classifyProviderError(err, 'openai');
    }
  }
}

export const openAiProvider = new OpenAiProvider();
