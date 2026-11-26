import { AiProviderId } from './ai-provider.interface';
import { AiServiceError, classifyProviderError } from './ai-errors';

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
  provider?: AiProviderId;
  signal?: AbortSignal;
}

export interface RetryAttemptResult<T> {
  value: T;
  attempts: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class RetryService {
  private readonly defaultBaseDelayMs: number;

  constructor(defaultBaseDelayMs = 450) {
    this.defaultBaseDelayMs = defaultBaseDelayMs;
  }

  public async execute<T>(
    operation: (attemptIndex: number, abortSignal: AbortSignal) => Promise<T>,
    options: RetryOptions = {}
  ): Promise<RetryAttemptResult<T>> {
    const maxRetries = options.maxRetries ?? 2;
    const baseDelayMs = options.baseDelayMs ?? this.defaultBaseDelayMs;
    const maxDelayMs = options.maxDelayMs ?? 12000;
    const timeoutMs = options.timeoutMs ?? 45000;

    let attempts = 0;
    let lastError: AiServiceError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      attempts++;
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => {
        controller.abort(new Error(`AI request timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      const onOuterAbort = () => controller.abort(options.signal?.reason);
      if (options.signal) {
        if (options.signal.aborted) {
          clearTimeout(timeoutHandle);
          throw new AiServiceError({
            message: 'Request cancelled by caller.',
            statusCode: 499,
            category: 'timeout',
            retryable: false,
            switchProviderAllowed: false,
            provider: options.provider,
          });
        }
        options.signal.addEventListener('abort', onOuterAbort, { once: true });
      }

      try {
        const value = await operation(attempt, controller.signal);
        return { value, attempts };
      } catch (err: any) {
        const classified = classifyProviderError(err, options.provider);
        lastError = classified;

        // Do not retry non-retryable errors (auth_error, invalid_request, caller cancel)
        if (!classified.retryable || options.signal?.aborted || attempt >= maxRetries) {
          throw classified;
        }

        // Respect provider Retry-After header if supplied; otherwise exponential backoff + full jitter
        const expDelay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));
        const jitter = Math.floor(Math.random() * Math.min(400, expDelay * 0.4));
        const delayMs = classified.retryAfterMs
          ? Math.min(maxDelayMs, classified.retryAfterMs)
          : expDelay + jitter;

        await sleep(delayMs);
      } finally {
        clearTimeout(timeoutHandle);
        if (options.signal) {
          options.signal.removeEventListener('abort', onOuterAbort);
        }
      }
    }

    throw (
      lastError ||
      new AiServiceError({
        message: 'AI retry attempts exhausted.',
        statusCode: 503,
        category: 'unknown',
        retryable: false,
        switchProviderAllowed: true,
        provider: options.provider,
      })
    );
  }
}

export const retryService = new RetryService();
