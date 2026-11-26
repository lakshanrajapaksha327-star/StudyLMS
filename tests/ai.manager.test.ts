import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AiServiceError } from '../server/ai/ai-errors';
import { AiManagerService, stripMarkdownJsonFences } from '../server/ai/ai-manager.service';
import { AiProviderAdapter, AiTaskType } from '../server/ai/ai-provider.interface';
import { AiRouterService } from '../server/ai/ai-router.service';
import { CircuitBreakerService } from '../server/ai/circuit-breaker.service';
import { RetryService } from '../server/ai/retry.service';

function makeMockAdapter(
  id: 'gemini' | 'openai' | 'anthropic',
  overrides: Partial<AiProviderAdapter> = {}
): AiProviderAdapter {
  return {
    id,
    displayName: id.toUpperCase(),
    isConfigured: () => true,
    supportsTask: (task: AiTaskType) =>
      id === 'gemini' || (task !== 'embeddings' && task !== 'tts' && task !== 'audio_transcription'),
    getConfiguredModel: (_task: AiTaskType, preferred?: string) => preferred || `${id}-default-model`,
    generateText: vi.fn(async (_req, model) => ({
      text: `Response from ${id}`,
      provider: id,
      model,
      latencyMs: 12,
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30, actualCostUsd: 0 },
    })),
    ...overrides,
  };
}

describe('Centralized AiManagerService Resilience & Routing', () => {
  it('routes primary Gemini requests cleanly without fallback', async () => {
    const gemini = makeMockAdapter('gemini');
    const openai = makeMockAdapter('openai');
    const manager = new AiManagerService({
      adapters: [gemini, openai],
      circuitBreaker: new CircuitBreakerService({ failureThreshold: 3, cooldownMs: 5000 }),
      retryService: new RetryService(1),
      router: new AiRouterService(),
    });

    const result = await manager.generate({
      taskType: 'simple_text',
      feature: 'chat',
      contents: 'Explain photosynthesis briefly.',
    });

    expect(result.provider).toBe('gemini');
    expect(result.fallbackUsed).toBe(false);
    expect(result.text).toBe('Response from gemini');
    expect(openai.generateText).not.toHaveBeenCalled();
  });

  it('automatically fails over to secondary OpenAI provider on primary 429 rate-limit', async () => {
    const gemini = makeMockAdapter('gemini', {
      generateText: vi.fn(async () => {
        throw { status: 429, message: 'RESOURCE_EXHAUSTED quota exceeded' };
      }),
    });
    const openai = makeMockAdapter('openai');

    const manager = new AiManagerService({
      adapters: [gemini, openai],
      circuitBreaker: new CircuitBreakerService({ failureThreshold: 3, cooldownMs: 5000 }),
      retryService: new RetryService(1),
      router: new AiRouterService(),
    });

    const result = await manager.generate({
      taskType: 'complex_reasoning',
      feature: 'quiz',
      contents: 'Generate a quiz question.',
    });

    expect(result.provider).toBe('openai');
    expect(result.fallbackUsed).toBe(true);
    expect(result.text).toBe('Response from openai');
    expect(gemini.generateText).toHaveBeenCalled();
    expect(openai.generateText).toHaveBeenCalledTimes(1);
  });

  it('opens circuit breaker after repeated 503 outages and routes subsequent requests directly to healthy fallback', async () => {
    const breaker = new CircuitBreakerService({ failureThreshold: 2, cooldownMs: 10_000 });
    const geminiGenerate = vi.fn(async () => {
      throw { status: 503, message: 'Service temporarily overloaded' };
    });
    const gemini = makeMockAdapter('gemini', { generateText: geminiGenerate });
    const openai = makeMockAdapter('openai');

    const manager = new AiManagerService({
      adapters: [gemini, openai],
      circuitBreaker: breaker,
      retryService: new RetryService(1),
      router: new AiRouterService(),
    });

    await manager.generate({ taskType: 'simple_text', feature: 'chat', contents: 'Req 1' });
    await manager.generate({ taskType: 'simple_text', feature: 'chat', contents: 'Req 2' });
    expect(breaker.getSnapshot('gemini').state).toBe('open');

    const callsBefore = geminiGenerate.mock.calls.length;
    const req3 = await manager.generate({ taskType: 'simple_text', feature: 'chat', contents: 'Req 3' });

    expect(req3.provider).toBe('openai');
    expect(geminiGenerate.mock.calls.length).toBe(callsBefore); // Skipped immediately while circuit open
  });

  it('does NOT mask permanent 401 auth errors by failing over to another provider', async () => {
    const gemini = makeMockAdapter('gemini', {
      generateText: vi.fn(async () => {
        throw { status: 401, message: 'API_KEY_INVALID bad key AIzaSySecret1234567890abcdef' };
      }),
    });
    const openai = makeMockAdapter('openai');

    const manager = new AiManagerService({
      adapters: [gemini, openai],
      circuitBreaker: new CircuitBreakerService(),
      retryService: new RetryService(1),
      router: new AiRouterService(),
    });

    await expect(
      manager.generate({
        taskType: 'simple_text',
        feature: 'chat',
        contents: 'Hello',
      })
    ).rejects.toMatchObject({ category: 'auth_error', statusCode: 502 });

    expect(openai.generateText).not.toHaveBeenCalled();
  });

  it('strips markdown JSON fences and performs single repair pass for structured outputs', async () => {
    expect(stripMarkdownJsonFences('```json\n{"ok":true}\n```')).toBe('{"ok":true}');

    const gemini = makeMockAdapter('gemini', {
      generateText: vi
        .fn()
        .mockResolvedValueOnce({
          text: 'Not valid json output',
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          latencyMs: 10,
          usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10, actualCostUsd: 0 },
        })
        .mockResolvedValueOnce({
          text: '```json\n{"title":"Fixed Guide","score":95}\n```',
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          latencyMs: 12,
          usage: { inputTokens: 8, outputTokens: 8, totalTokens: 16, actualCostUsd: 0 },
        }),
    });

    const manager = new AiManagerService({
      adapters: [gemini],
      circuitBreaker: new CircuitBreakerService(),
      retryService: new RetryService(1),
      router: new AiRouterService(),
    });

    const schema = z.object({ title: z.string(), score: z.number() });
    const result = await manager.generateStructured(
      { taskType: 'structured_json', feature: 'exam_prep', contents: 'Build exam guide' },
      schema
    );

    expect(result.data).toEqual({ title: 'Fixed Guide', score: 95 });
  });

  it('routes audio transcription exclusively to audio-capable provider and rejects empty audio', async () => {
    const transcribeMock = vi.fn(async () => ({
      text: '{"transcript":"Hello students"}',
      provider: 'gemini' as const,
      model: 'gemini-2.5-flash',
      latencyMs: 30,
      usage: { inputTokens: 100, outputTokens: 40, totalTokens: 140, actualCostUsd: 0 },
    }));
    const gemini = makeMockAdapter('gemini', { transcribeAudio: transcribeMock });
    const openai = makeMockAdapter('openai');

    const manager = new AiManagerService({
      adapters: [gemini, openai],
      circuitBreaker: new CircuitBreakerService(),
      retryService: new RetryService(1),
      router: new AiRouterService(),
    });

    await expect(manager.transcribeAudio('short', 'audio/mpeg')).rejects.toBeInstanceOf(AiServiceError);

    const validBase64 = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
    const res = await manager.transcribeAudio(validBase64, 'audio/wav', 'Transcribe lecture');
    expect(res.provider).toBe('gemini');
    expect(transcribeMock).toHaveBeenCalledTimes(1);
  });
});
