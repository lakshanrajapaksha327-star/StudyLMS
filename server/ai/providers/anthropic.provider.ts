import Anthropic from '@anthropic-ai/sdk';
import {
  AiGenerateRequest,
  AiProviderAdapter,
  AiProviderExecutionResult,
  AiTaskType,
} from '../ai-provider.interface';
import { AiServiceError, classifyProviderError } from '../ai-errors';
import { modelRegistry } from '../model-registry';

const ANTHROPIC_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

export function convertContentsToAnthropicMessages(
  contents: AiGenerateRequest['contents']
): Anthropic.MessageParam[] {
  if (typeof contents === 'string') {
    return [{ role: 'user', content: contents }];
  }

  const contentArray = Array.isArray(contents) ? contents : [{ role: 'user', parts: contents.parts }];
  const out: Anthropic.MessageParam[] = [];

  for (const item of contentArray) {
    const role: 'user' | 'assistant' =
      item.role === 'model' || item.role === 'assistant' ? 'assistant' : 'user';
    const blocks: Anthropic.ContentBlockParam[] = [];

    for (const p of item.parts) {
      if (p.text) {
        blocks.push({ type: 'text', text: p.text });
      } else if (p.inlineData) {
        const mime = (p.inlineData.mimeType || '').toLowerCase();
        if (mime === 'application/pdf') {
          blocks.push({
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: p.inlineData.data,
            },
          } as any);
        } else if (ANTHROPIC_IMAGE_MIMES.has(mime)) {
          blocks.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: mime as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: p.inlineData.data,
            },
          });
        } else {
          throw new AiServiceError({
            message: `Anthropic Claude does not support binary MIME type "${p.inlineData.mimeType}". Only PDF documents and JPEG/PNG/GIF/WEBP images are supported.`,
            statusCode: 422,
            category: 'invalid_request',
            retryable: false,
            switchProviderAllowed: true,
            provider: 'anthropic',
          });
        }
      }
    }

    if (blocks.length > 0) {
      out.push({ role, content: blocks });
    }
  }

  return out;
}

export class AnthropicProvider implements AiProviderAdapter {
  public readonly id = 'anthropic' as const;
  public readonly displayName = 'Anthropic Claude (Optional Provider)';

  public isConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  }

  public supportsTask(taskType: AiTaskType): boolean {
    return taskType !== 'embeddings' && taskType !== 'tts' && taskType !== 'audio_transcription';
  }

  public getConfiguredModel(taskType: AiTaskType): string {
    return modelRegistry.resolveModelForProvider('anthropic', taskType);
  }

  private getClient(): Anthropic {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      throw new AiServiceError({
        message: 'ANTHROPIC_API_KEY environment variable is not configured.',
        statusCode: 503,
        category: 'provider_unavailable',
        retryable: false,
        switchProviderAllowed: true,
        provider: 'anthropic',
      });
    }
    return new Anthropic({ apiKey });
  }

  public async generateText(
    req: AiGenerateRequest,
    model: string,
    signal?: AbortSignal
  ): Promise<AiProviderExecutionResult> {
    const client = this.getClient();
    const startTime = Date.now();
    const requireJson = req.responseMimeType === 'application/json';

    const systemParts: string[] = [];
    if (req.systemInstruction) systemParts.push(req.systemInstruction);
    if (requireJson) {
      systemParts.push('Output ONLY valid JSON matching the requested schema without markdown fences.');
      if (req.jsonSchemaDescription) {
        systemParts.push(`Expected JSON shape:\n${req.jsonSchemaDescription}`);
      }
    }

    try {
      const response = await client.messages.create(
        {
          model,
          max_tokens: 4096,
          ...(systemParts.length > 0 ? { system: systemParts.join('\n\n') } : {}),
          messages: convertContentsToAnthropicMessages(req.contents),
        },
        signal ? { signal } : undefined
      );

      const latencyMs = Date.now() - startTime;
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();

      const inputTokens = typeof response.usage?.input_tokens === 'number' ? response.usage.input_tokens : null;
      const outputTokens =
        typeof response.usage?.output_tokens === 'number' ? response.usage.output_tokens : null;
      const totalTokens =
        inputTokens !== null || outputTokens !== null ? (inputTokens || 0) + (outputTokens || 0) : null;

      return {
        text,
        provider: 'anthropic',
        model: response.model || model,
        latencyMs,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens,
          actualCostUsd: null,
        },
        finishReason: response.stop_reason || undefined,
      };
    } catch (err) {
      throw classifyProviderError(err, 'anthropic');
    }
  }
}

export const anthropicProvider = new AnthropicProvider();
