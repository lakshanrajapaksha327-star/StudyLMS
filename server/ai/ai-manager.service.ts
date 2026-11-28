import crypto from 'crypto';
import { ZodType } from 'zod';
import { aiPromptRepository } from '../repositories/ai_prompt.repository';
import { AuthContext } from '../repositories/base.repository';
import { AiErrorCategory, AiProviderId, AiServiceError, classifyProviderError } from './ai-errors';
import {
  AiEmbeddingResult,
  AiGenerateRequest,
  AiManagedResponse,
  AiProviderAdapter,
  AiProviderHealthSnapshot,
  AiSpeechResult,
  AiTaskType,
} from './ai-provider.interface';
import { AiRouterService, aiRouterService } from './ai-router.service';
import { CircuitBreakerService, circuitBreakerService } from './circuit-breaker.service';
import { modelRegistry } from './model-registry';
import { RetryService, retryService } from './retry.service';
import { anthropicProvider } from './providers/anthropic.provider';
import { geminiProvider } from './providers/gemini.provider';
import { openAiProvider } from './providers/openai.provider';
import { userPreferencesRepository } from '../repositories/user_preferences.repository';

interface CacheEntry {
  value: AiManagedResponse;
  expiresAt: number;
}

interface UserRateBucket {
  timestamps: number[];
  dailyTokensUsed: number;
  dayKey: string;
  activeConcurrency: number;
}

export interface AiRecentEventRecord {
  timestamp: string;
  userId: string;
  feature: string;
  provider: AiProviderId;
  model: string;
  status: 'success' | 'fallback_success' | 'cached' | 'error';
  errorCategory?: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  costUsd: number | null;
}

export interface AiProviderDiagnosticResult {
  id: AiProviderId;
  displayName: string;
  diagnosticState:
    | 'configured'
    | 'not_configured'
    | 'connection_verified'
    | 'temporarily_unavailable'
    | 'circuit_open'
    | 'auth_failure';
  activeModels: Record<string, string>;
  latencyMs: number | null;
  circuitState: 'closed' | 'open' | 'half_open';
  errorCategory?: AiErrorCategory | null;
  message: string;
  checkedAt: string;
}

export function stripMarkdownJsonFences(raw: string): string {
  const trimmed = String(raw || '').trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) return fenced[1].trim();
  return trimmed;
}

function estimateContentLength(contents: AiGenerateRequest['contents']): number {
  if (typeof contents === 'string') return contents.length;
  const arr = Array.isArray(contents) ? contents : [contents];
  let len = 0;
  for (const item of arr) {
    for (const part of item.parts || []) {
      if (part.text) len += part.text.length;
      if (part.inlineData?.data) len += Math.min(2000, part.inlineData.data.length);
    }
  }
  return len;
}

export class AiManagerService {
  private readonly adapters = new Map<AiProviderId, AiProviderAdapter>();
  private readonly circuitBreaker: CircuitBreakerService;
  private readonly retryService: RetryService;
  private readonly router: AiRouterService;
  private readonly cache = new Map<string, CacheEntry>();
  private readonly userBuckets = new Map<string, UserRateBucket>();
  private readonly privacyCache = new Map<string, { privacyMode: boolean; expiresAt: number }>();
  private readonly recentEvents: AiRecentEventRecord[] = [];
  private readonly maxRecentEvents = 120;

  private readonly maxInputChars = Number(process.env.AI_MAX_INPUT_CHARS) || 120_000;
  private readonly perUserRpm = Number(process.env.AI_USER_RPM_LIMIT) || 45;
  private readonly perUserConcurrency = Number(process.env.AI_USER_CONCURRENCY_LIMIT) || 6;
  private readonly perUserDailyTokenBudget = Number(process.env.AI_USER_DAILY_TOKEN_BUDGET) || 500_000;

  constructor(deps?: {
    adapters?: AiProviderAdapter[];
    circuitBreaker?: CircuitBreakerService;
    retryService?: RetryService;
    router?: AiRouterService;
  }) {
    const list = deps?.adapters ?? [geminiProvider, openAiProvider, anthropicProvider];
    for (const a of list) {
      this.adapters.set(a.id, a);
    }
    this.circuitBreaker = deps?.circuitBreaker ?? circuitBreakerService;
    this.retryService = deps?.retryService ?? retryService;
    this.router = deps?.router ?? aiRouterService;
  }

  public setUserPrivacyCache(userId: string, privacyMode: boolean): void {
    this.privacyCache.set(userId, { privacyMode, expiresAt: Date.now() + 5 * 60_000 });
  }

  private async isPrivacyModeEnabled(auth?: AuthContext): Promise<boolean> {
    if (!auth?.userId || !auth.idToken) return false;
    const cached = this.privacyCache.get(auth.userId);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.privacyMode;
    }
    try {
      const prefs = await userPreferencesRepository.getByUserId(auth);
      const enabled = Boolean(prefs?.privacyMode);
      this.setUserPrivacyCache(auth.userId, enabled);
      return enabled;
    } catch {
      return false;
    }
  }

  private getTodayKey(): string {
    return new Date().toISOString().split('T')[0];
  }

  private acquireUserSlot(userId?: string): () => void {
    const uid = userId || 'anonymous';
    const now = Date.now();
    const today = this.getTodayKey();
    let bucket = this.userBuckets.get(uid);
    if (!bucket) {
      bucket = { timestamps: [], dailyTokensUsed: 0, dayKey: today, activeConcurrency: 0 };
      this.userBuckets.set(uid, bucket);
    }
    if (bucket.dayKey !== today) {
      bucket.dayKey = today;
      bucket.dailyTokensUsed = 0;
    }

    bucket.timestamps = bucket.timestamps.filter((t) => now - t < 60_000);
    if (bucket.timestamps.length >= this.perUserRpm) {
      throw new AiServiceError({
        message: 'AI request rate limit reached for your account. Please wait a few seconds and retry.',
        statusCode: 429,
        category: 'rate_limit',
        retryable: false,
        switchProviderAllowed: false,
      });
    }

    if (bucket.activeConcurrency >= this.perUserConcurrency) {
      throw new AiServiceError({
        message: 'Too many simultaneous AI operations running. Please wait for one to finish.',
        statusCode: 429,
        category: 'concurrency_limit',
        retryable: false,
        switchProviderAllowed: false,
      });
    }

    if (bucket.dailyTokensUsed >= this.perUserDailyTokenBudget) {
      throw new AiServiceError({
        message: 'Daily AI usage budget reached for your account.',
        statusCode: 429,
        category: 'budget_exceeded',
        retryable: false,
        switchProviderAllowed: false,
      });
    }

    bucket.timestamps.push(now);
    bucket.activeConcurrency += 1;

    let released = false;
    return () => {
      if (released) return;
      released = true;
      bucket!.activeConcurrency = Math.max(0, bucket!.activeConcurrency - 1);
    };
  }

  private recordUserTokens(userId: string | undefined, totalTokens: number | null): void {
    if (!userId || !totalTokens || totalTokens <= 0) return;
    const bucket = this.userBuckets.get(userId);
    if (bucket) {
      bucket.dailyTokensUsed += totalTokens;
    }
  }

  private buildCacheKey(req: AiGenerateRequest): string {
    const payload = JSON.stringify({
      taskType: req.taskType,
      system: req.systemInstruction || '',
      contents: req.contents,
      mime: req.responseMimeType || 'text/plain',
      preferredModel: req.preferredModel || '',
    });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  private getCached(key: string): AiManagedResponse | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return {
      ...entry.value,
      cached: true,
    };
  }

  private setCached(key: string, value: AiManagedResponse, ttlMs = 10 * 60_000): void {
    if (this.cache.size >= 150) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  private recordTelemetry(params: {
    auth?: AuthContext;
    feature: string;
    provider: AiProviderId;
    model: string;
    latencyMs: number;
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
    actualCostUsd: number | null;
    status: 'success' | 'fallback_success' | 'cached' | 'error';
    errorCategory?: string;
    cached: boolean;
    fallbackUsed: boolean;
  }): void {
    const uid = params.auth?.userId || 'system';
    const event: AiRecentEventRecord = {
      timestamp: new Date().toISOString(),
      userId: uid,
      feature: params.feature,
      provider: params.provider,
      model: params.model,
      status: params.status,
      errorCategory: params.errorCategory,
      latencyMs: params.latencyMs,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      totalTokens: params.totalTokens,
      costUsd: params.actualCostUsd ?? null,
    };
    this.recentEvents.unshift(event);
    if (this.recentEvents.length > this.maxRecentEvents) {
      this.recentEvents.pop();
    }

    if (params.auth) {
      void this.isPrivacyModeEnabled(params.auth)
        .then((privacyEnabled) => {
          if (privacyEnabled) {
            return;
          }
          return aiPromptRepository.logPrompt(
            {
              userId: params.auth!.userId,
              feature: params.feature,
              provider: params.provider,
              latencyMs: params.latencyMs,
              inputTokens: params.inputTokens,
              outputTokens: params.outputTokens,
              costUsd: params.actualCostUsd ?? null,
              tokensConsumed: params.totalTokens ?? 0,
              modelName: params.model,
              status: params.status,
              errorCategory: params.errorCategory,
              cached: params.cached,
              fallbackUsed: params.fallbackUsed,
            },
            params.auth!
          );
        })
        .catch(() => {});
    }
  }

  public async generate(req: AiGenerateRequest): Promise<AiManagedResponse> {
    const contentLen = estimateContentLength(req.contents);
    if (contentLen > this.maxInputChars) {
      throw new AiServiceError({
        message: `Input exceeds maximum allowed size (${this.maxInputChars.toLocaleString()} characters).`,
        statusCode: 400,
        category: 'invalid_request',
        retryable: false,
        switchProviderAllowed: false,
      });
    }

    const cacheKey = req.cacheable ? this.buildCacheKey(req) : null;
    if (cacheKey) {
      const hit = this.getCached(cacheKey);
      if (hit) {
        this.recordTelemetry({
          auth: req.auth,
          feature: req.feature,
          provider: hit.provider,
          model: hit.model,
          latencyMs: 1,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          actualCostUsd: hit.usage.actualCostUsd ?? null,
          status: 'cached',
          cached: true,
          fallbackUsed: hit.fallbackUsed,
        });
        return hit;
      }
    }

    const releaseSlot = this.acquireUserSlot(req.auth?.userId);
    try {
      const candidates = this.router.buildProviderOrder(
        this.adapters,
        req.taskType,
        req.preferredModel,
        this.circuitBreaker
      );

      if (candidates.length === 0) {
        const configuredAny = Array.from(this.adapters.values()).some(
          (a) => a.isConfigured() && a.supportsTask(req.taskType)
        );
        throw new AiServiceError({
          message: configuredAny
            ? 'All configured AI providers are temporarily in recovery cooldown after repeated errors. Please try again shortly.'
            : 'No AI provider API key is currently configured on the server.',
          statusCode: 503,
          category: configuredAny ? 'circuit_open' : 'provider_unavailable',
          retryable: false,
          switchProviderAllowed: false,
        });
      }

      let lastError: AiServiceError | null = null;
      let totalAttempts = 0;

      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        const fallbackUsed = i > 0 || !candidate.isPrimary;

        try {
          const retryResult = await this.retryService.execute(
            async (_attempt, abortSignal) => {
              return candidate.adapter.generateText(req, candidate.model, abortSignal);
            },
            {
              maxRetries: 2,
              timeoutMs: req.timeoutMs ?? (req.taskType === 'complex_reasoning' ? 65_000 : 45_000),
              provider: candidate.adapter.id,
              signal: req.signal,
            }
          );

          totalAttempts += retryResult.attempts;
          const res = retryResult.value;
          this.circuitBreaker.recordSuccess(candidate.adapter.id, res.latencyMs);
          this.recordUserTokens(req.auth?.userId, res.usage.totalTokens);

          const managed: AiManagedResponse = {
            ...res,
            cached: false,
            fallbackUsed,
            attempts: totalAttempts,
          };

          if (cacheKey && managed.text.trim()) {
            this.setCached(cacheKey, managed, req.cacheTtlMs);
          }

          this.recordTelemetry({
            auth: req.auth,
            feature: req.feature,
            provider: managed.provider,
            model: managed.model,
            latencyMs: managed.latencyMs,
            inputTokens: managed.usage.inputTokens,
            outputTokens: managed.usage.outputTokens,
            totalTokens: managed.usage.totalTokens,
            actualCostUsd: managed.usage.actualCostUsd ?? null,
            status: fallbackUsed ? 'fallback_success' : 'success',
            cached: false,
            fallbackUsed,
          });

          return managed;
        } catch (err) {
          const classified = classifyProviderError(err, candidate.adapter.id);
          lastError = classified;
          this.circuitBreaker.recordFailure(candidate.adapter.id, classified.category);

          if (!classified.switchProviderAllowed) {
            this.recordTelemetry({
              auth: req.auth,
              feature: req.feature,
              provider: candidate.adapter.id,
              model: candidate.model,
              latencyMs: 0,
              inputTokens: null,
              outputTokens: null,
              totalTokens: null,
              actualCostUsd: null,
              status: 'error',
              errorCategory: classified.category,
              cached: false,
              fallbackUsed,
            });
            throw classified;
          }
        }
      }

      const finalErr =
        lastError ||
        new AiServiceError({
          message: 'All configured AI providers failed to complete the request.',
          statusCode: 503,
          category: 'provider_unavailable',
          retryable: false,
          switchProviderAllowed: false,
        });

      this.recordTelemetry({
        auth: req.auth,
        feature: req.feature,
        provider: finalErr.provider || modelRegistry.getPrimaryProviderId(),
        model: req.preferredModel || 'unknown',
        latencyMs: 0,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        actualCostUsd: null,
        status: 'error',
        errorCategory: finalErr.category,
        cached: false,
        fallbackUsed: candidates.length > 1,
      });

      throw finalErr;
    } finally {
      releaseSlot();
    }
  }

  /**
   * Generate and strictly validate structured JSON via Zod.
   * Performs a single controlled repair attempt if malformed JSON is returned;
   * never fabricates placeholder data if validation fails.
   */
  public async generateStructured<T>(
    req: Omit<AiGenerateRequest, 'responseMimeType'>,
    schema: ZodType<T>
  ): Promise<{ data: T; meta: AiManagedResponse }> {
    const first = await this.generate({
      ...req,
      responseMimeType: 'application/json',
    });

    try {
      const cleaned = stripMarkdownJsonFences(first.text);
      const parsed = JSON.parse(cleaned);
      const validated = schema.parse(parsed);
      return { data: validated, meta: first };
    } catch (parseErr: any) {
      const repairPrompt = `Your previous response could not be parsed or failed schema validation (${String(
        parseErr?.message || 'Invalid JSON'
      ).slice(0, 300)}).
Return ONLY valid JSON matching the exact schema requested. Do not add markdown fences or commentary.

Previous raw output:
${first.text.slice(0, 6000)}`;

      const repaired = await this.generate({
        ...req,
        taskType: 'structured_json',
        cacheable: false,
        promptSummary: `${req.promptSummary || req.feature} (JSON repair)`,
        contents: repairPrompt,
        responseMimeType: 'application/json',
      });

      try {
        const cleanedRepaired = stripMarkdownJsonFences(repaired.text);
        const parsedRepaired = JSON.parse(cleanedRepaired);
        const validatedRepaired = schema.parse(parsedRepaired);
        return { data: validatedRepaired, meta: repaired };
      } catch (finalErr: any) {
        throw new AiServiceError({
          message: `AI returned malformed structured data that failed schema validation: ${String(
            finalErr?.message || 'Invalid JSON structure'
          ).slice(0, 200)}`,
          statusCode: 502,
          category: 'malformed_output',
          retryable: false,
          switchProviderAllowed: false,
          provider: repaired.provider,
        });
      }
    }
  }

  public async embedTexts(
    texts: string[],
    taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' = 'RETRIEVAL_DOCUMENT',
    preferredProvider?: AiProviderId
  ): Promise<AiEmbeddingResult> {
    const targetProvider = preferredProvider || modelRegistry.getCanonicalEmbeddingProvider();
    const adapter = this.adapters.get(targetProvider);

    // Strictly enforce canonical embedding vector-space isolation:
    // never silently fall back to a different embedding provider's vector space!
    if (!adapter || !adapter.isConfigured() || !adapter.embedTexts) {
      throw new AiServiceError({
        message: `Canonical embedding provider "${targetProvider}" is not configured or unavailable.`,
        statusCode: 503,
        category: 'provider_unavailable',
        retryable: false,
        switchProviderAllowed: false,
        provider: targetProvider,
      });
    }

    if (!this.circuitBreaker.canExecute(targetProvider)) {
      throw new AiServiceError({
        message: `Canonical embedding provider "${targetProvider}" circuit breaker is open.`,
        statusCode: 503,
        category: 'circuit_open',
        retryable: false,
        switchProviderAllowed: false,
        provider: targetProvider,
      });
    }

    try {
      const res = await this.retryService.execute(
        async () => adapter.embedTexts!(texts, taskType),
        { maxRetries: 2, timeoutMs: 45_000, provider: adapter.id }
      );
      this.circuitBreaker.recordSuccess(adapter.id, res.value.latencyMs);
      return res.value;
    } catch (err) {
      const classified = classifyProviderError(err, adapter.id);
      this.circuitBreaker.recordFailure(adapter.id, classified.category);
      throw classified;
    }
  }

  public async generateSpeech(
    text: string,
    voice = 'Kore',
    auth?: AuthContext
  ): Promise<AiSpeechResult> {
    const releaseSlot = this.acquireUserSlot(auth?.userId);
    try {
      const candidates = this.router.buildProviderOrder(
        this.adapters,
        'tts',
        undefined,
        this.circuitBreaker
      );

      if (candidates.length === 0) {
        throw new AiServiceError({
          message: 'No configured Text-to-Speech AI provider is available.',
          statusCode: 503,
          category: 'provider_unavailable',
          retryable: false,
          switchProviderAllowed: false,
        });
      }

      let lastErr: AiServiceError | null = null;
      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        if (!candidate.adapter.generateSpeech) continue;
        try {
          const res = await this.retryService.execute(
            async () => candidate.adapter.generateSpeech!(text, voice),
            { maxRetries: 1, timeoutMs: 35_000, provider: candidate.adapter.id }
          );
          this.circuitBreaker.recordSuccess(candidate.adapter.id, res.value.latencyMs);
          this.recordTelemetry({
            auth,
            feature: 'speech',
            provider: res.value.provider,
            model: res.value.model,
            latencyMs: res.value.latencyMs,
            inputTokens: null,
            outputTokens: null,
            totalTokens: null,
            actualCostUsd: null,
            status: i > 0 ? 'fallback_success' : 'success',
            cached: false,
            fallbackUsed: i > 0,
          });
          return res.value;
        } catch (err) {
          const classified = classifyProviderError(err, candidate.adapter.id);
          lastErr = classified;
          this.circuitBreaker.recordFailure(candidate.adapter.id, classified.category);
          if (!classified.switchProviderAllowed) throw classified;
        }
      }

      throw (
        lastErr ||
        new AiServiceError({
          message: 'TTS generation failed.',
          statusCode: 503,
          category: 'provider_unavailable',
          retryable: false,
          switchProviderAllowed: false,
        })
      );
    } finally {
      releaseSlot();
    }
  }

  public async transcribeAudio(
    audioBase64: string,
    mimeType: string,
    prompt?: string,
    auth?: AuthContext
  ): Promise<AiManagedResponse> {
    if (!audioBase64 || audioBase64.length < 32) {
      throw new AiServiceError({
        message: 'Uploaded audio payload is empty or invalid.',
        statusCode: 400,
        category: 'invalid_request',
        retryable: false,
        switchProviderAllowed: false,
      });
    }

    const releaseSlot = this.acquireUserSlot(auth?.userId);
    try {
      const candidates = this.router.buildProviderOrder(
        this.adapters,
        'audio_transcription',
        undefined,
        this.circuitBreaker
      );

      if (candidates.length === 0) {
        throw new AiServiceError({
          message: 'No configured AI audio transcription provider is currently available.',
          statusCode: 503,
          category: 'provider_unavailable',
          retryable: false,
          switchProviderAllowed: false,
        });
      }

      let lastErr: AiServiceError | null = null;
      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        if (!candidate.adapter.transcribeAudio) continue;
        const fallbackUsed = i > 0 || !candidate.isPrimary;

        try {
          const res = await this.retryService.execute(
            async (_attempt, abortSignal) =>
              candidate.adapter.transcribeAudio!(audioBase64, mimeType, prompt, abortSignal),
            { maxRetries: 1, timeoutMs: 90_000, provider: candidate.adapter.id }
          );

          this.circuitBreaker.recordSuccess(candidate.adapter.id, res.value.latencyMs);
          this.recordUserTokens(auth?.userId, res.value.usage.totalTokens);

          const managed: AiManagedResponse = {
            ...res.value,
            cached: false,
            fallbackUsed,
            attempts: res.attempts,
          };

          this.recordTelemetry({
            auth,
            feature: 'audio_lecture',
            provider: managed.provider,
            model: managed.model,
            latencyMs: managed.latencyMs,
            inputTokens: managed.usage.inputTokens,
            outputTokens: managed.usage.outputTokens,
            totalTokens: managed.usage.totalTokens,
            actualCostUsd: managed.usage.actualCostUsd ?? null,
            status: fallbackUsed ? 'fallback_success' : 'success',
            cached: false,
            fallbackUsed,
          });

          return managed;
        } catch (err) {
          const classified = classifyProviderError(err, candidate.adapter.id);
          lastErr = classified;
          this.circuitBreaker.recordFailure(candidate.adapter.id, classified.category);
          if (!classified.switchProviderAllowed) throw classified;
        }
      }

      throw (
        lastErr ||
        new AiServiceError({
          message: 'Audio transcription failed across configured AI providers.',
          statusCode: 503,
          category: 'provider_unavailable',
          retryable: false,
          switchProviderAllowed: false,
        })
      );
    } finally {
      releaseSlot();
    }
  }

  public async probeProviders(): Promise<AiProviderDiagnosticResult[]> {
    const order: AiProviderId[] = ['gemini', 'openai', 'anthropic'];
    const checkedAt = new Date().toISOString();

    const results = await Promise.all(
      order.map(async (id): Promise<AiProviderDiagnosticResult> => {
        const adapter = this.adapters.get(id);
        const circuit = this.circuitBreaker.getSnapshot(id);
        const activeModels: Record<string, string> = adapter
          ? {
              simple_text: adapter.getConfiguredModel('simple_text'),
              complex_reasoning: adapter.getConfiguredModel('complex_reasoning'),
              multimodal: adapter.getConfiguredModel('multimodal'),
              structured_json: adapter.getConfiguredModel('structured_json'),
            }
          : {};

        if (!adapter || !adapter.isConfigured()) {
          return {
            id,
            displayName: adapter?.displayName || id,
            diagnosticState: 'not_configured',
            activeModels,
            latencyMs: null,
            circuitState: circuit.state,
            errorCategory: null,
            message: 'API key environment secret is not configured on the server.',
            checkedAt,
          };
        }

        if (circuit.state === 'open') {
          return {
            id,
            displayName: adapter.displayName,
            diagnosticState: 'circuit_open',
            activeModels,
            latencyMs: circuit.lastLatencyMs,
            circuitState: circuit.state,
            errorCategory: circuit.lastErrorCategory,
            message: `Circuit breaker is open (${Math.ceil(circuit.cooldownRemainingMs / 1000)}s cooldown remaining).`,
            checkedAt,
          };
        }

        const start = Date.now();
        try {
          const model = adapter.getConfiguredModel('simple_text');
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 10_000);
          try {
            await adapter.generateText(
              {
                taskType: 'simple_text',
                feature: 'chat',
                contents: 'Reply with a single word: OK',
              },
              model,
              controller.signal
            );
          } finally {
            clearTimeout(timer);
          }
          const latencyMs = Date.now() - start;
          return {
            id,
            displayName: adapter.displayName,
            diagnosticState: 'connection_verified',
            activeModels,
            latencyMs,
            circuitState: circuit.state,
            errorCategory: null,
            message: `Live probe succeeded in ${latencyMs}ms using ${model}.`,
            checkedAt,
          };
        } catch (err) {
          const classified = classifyProviderError(err, id);
          const diagnosticState: AiProviderDiagnosticResult['diagnosticState'] =
            classified.category === 'auth_error' ? 'auth_failure' : 'temporarily_unavailable';
          return {
            id,
            displayName: adapter.displayName,
            diagnosticState,
            activeModels,
            latencyMs: Date.now() - start,
            circuitState: this.circuitBreaker.getSnapshot(id).state,
            errorCategory: classified.category,
            message: classified.message,
            checkedAt,
          };
        }
      })
    );

    return results;
  }

  public getHealthSnapshots(taskType: AiTaskType = 'complex_reasoning'): AiProviderHealthSnapshot[] {
    const order: AiProviderId[] = ['gemini', 'openai', 'anthropic'];
    return order.map((id) => {
      const adapter = this.adapters.get(id);
      const configured = Boolean(adapter?.isConfigured());
      const circuit = this.circuitBreaker.getSnapshot(id);
      let status: AiProviderHealthSnapshot['status'] = 'unavailable';

      if (configured) {
        if (circuit.state === 'open') {
          status = 'open_circuit';
        } else if (circuit.state === 'half_open' || circuit.recentFailureRate >= 0.3) {
          status = 'degraded';
        } else {
          status = 'healthy';
        }
      }

      return {
        id,
        displayName: adapter?.displayName || id,
        configured,
        available: configured && circuit.state !== 'open',
        configuredModel: adapter?.getConfiguredModel(taskType) || 'unconfigured',
        status,
        circuitState: circuit.state,
        cooldownRemainingMs: circuit.cooldownRemainingMs,
        lastLatencyMs: circuit.lastLatencyMs,
        recentFailureRate: circuit.recentFailureRate,
        totalRequests: circuit.totalRequests,
        totalFailures: circuit.totalFailures,
        lastErrorCategory: circuit.lastErrorCategory,
        lastCheckedAt: circuit.lastCheckedAt,
      };
    });
  }

  public getMonitoringOverview() {
    const canonicalEmb = modelRegistry.getCanonicalEmbeddingConfig();
    return {
      primaryProvider: modelRegistry.getPrimaryProviderId(),
      fallbackProvider: modelRegistry.getFallbackProviderId(),
      canonicalEmbeddingProvider: canonicalEmb.provider,
      canonicalEmbeddingModel: canonicalEmb.model,
      providers: this.getHealthSnapshots('complex_reasoning'),
      taskModels: {
        simple_text: modelRegistry.resolveModelForProvider(modelRegistry.getPrimaryProviderId(), 'simple_text'),
        complex_reasoning: modelRegistry.resolveModelForProvider(
          modelRegistry.getPrimaryProviderId(),
          'complex_reasoning'
        ),
        multimodal: modelRegistry.resolveModelForProvider(modelRegistry.getPrimaryProviderId(), 'multimodal'),
        structured_json: modelRegistry.resolveModelForProvider(
          modelRegistry.getPrimaryProviderId(),
          'structured_json'
        ),
        embeddings: canonicalEmb.model,
        tts: modelRegistry.resolveModelForProvider('gemini', 'tts'),
        audio_transcription: modelRegistry.resolveModelForProvider('gemini', 'audio_transcription'),
      },
      limits: {
        perUserRpm: this.perUserRpm,
        perUserConcurrency: this.perUserConcurrency,
        perUserDailyTokenBudget: this.perUserDailyTokenBudget,
        maxInputChars: this.maxInputChars,
      },
      recentEvents: this.recentEvents.slice(0, 40),
      cacheSize: this.cache.size,
    };
  }
}

export const aiManagerService = new AiManagerService();
