export type AiErrorCategory =
  | 'rate_limit'
  | 'server_error'
  | 'timeout'
  | 'network_error'
  | 'auth_error'
  | 'invalid_request'
  | 'malformed_output'
  | 'circuit_open'
  | 'provider_unavailable'
  | 'budget_exceeded'
  | 'concurrency_limit'
  | 'unknown';

export type AiProviderId = 'gemini' | 'openai' | 'anthropic';

export class AiServiceError extends Error {
  public readonly statusCode: number;
  public readonly category: AiErrorCategory;
  public readonly retryable: boolean;
  public readonly switchProviderAllowed: boolean;
  public readonly provider?: AiProviderId;
  public readonly retryAfterMs?: number;

  constructor(params: {
    message: string;
    statusCode?: number;
    category: AiErrorCategory;
    retryable: boolean;
    switchProviderAllowed: boolean;
    provider?: AiProviderId;
    retryAfterMs?: number;
  }) {
    super(sanitizeProviderMessage(params.message));
    this.name = 'AiServiceError';
    this.statusCode = params.statusCode ?? 500;
    this.category = params.category;
    this.retryable = params.retryable;
    this.switchProviderAllowed = params.switchProviderAllowed;
    this.provider = params.provider;
    this.retryAfterMs = params.retryAfterMs;
  }
}

export function sanitizeProviderMessage(raw: string): string {
  // Never leak Bearer tokens, API keys (AIza..., sk-..., sk-ant-...), or credential headers
  return String(raw || 'AI service request failed')
    .replace(/AIza[0-9A-Za-z\-_]{20,}/g, '[REDACTED_KEY]')
    .replace(/sk-(?:ant-|proj-)?[0-9A-Za-z\-_]{16,}/g, '[REDACTED_KEY]')
    .replace(/Bearer\s+[0-9A-Za-z\-._~+/]+=*/gi, 'Bearer [REDACTED]');
}

export function parseRetryAfterMs(err: any): number | undefined {
  const headers = err?.headers || err?.response?.headers;
  let retryAfterRaw: string | number | undefined = err?.retryAfterMs;

  if (!retryAfterRaw && headers) {
    if (typeof headers.get === 'function') {
      retryAfterRaw = headers.get('retry-after') || headers.get('Retry-After');
    } else {
      retryAfterRaw = headers['retry-after'] || headers['Retry-After'];
    }
  }

  if (typeof retryAfterRaw === 'number' && Number.isFinite(retryAfterRaw) && retryAfterRaw > 0) {
    return Math.min(retryAfterRaw, 30000);
  }
  if (typeof retryAfterRaw === 'string') {
    const trimmed = retryAfterRaw.trim();
    const secs = Number(trimmed);
    if (Number.isFinite(secs) && secs > 0) {
      return Math.min(secs * 1000, 30000);
    }
    const targetMs = Date.parse(trimmed);
    if (!Number.isNaN(targetMs)) {
      const delta = targetMs - Date.now();
      if (delta > 0) return Math.min(delta, 30000);
    }
  }

  // Also parse Gemini / OpenAI "Please retry in Xs" hints
  const msg = String(err?.message || '');
  const match = msg.match(/retry\s+in\s+(\d+(?:\.\d+)?)\s*s/i);
  if (match) {
    const secs = Number(match[1]);
    if (Number.isFinite(secs) && secs > 0) {
      return Math.min(Math.round(secs * 1000), 30000);
    }
  }

  return undefined;
}

export function classifyProviderError(err: any, provider?: AiProviderId): AiServiceError {
  if (err instanceof AiServiceError) return err;

  const status = Number(err?.status || err?.statusCode || err?.response?.status || 0);
  const code = String(err?.code || err?.cause?.code || '').toUpperCase();
  const msg = String(err?.message || 'AI provider error');
  const lower = msg.toLowerCase();
  const retryAfterMs = parseRetryAfterMs(err);

  // Permanent Authentication / Credential Errors (do NOT blindly switch provider or retry indefinitely)
  if (
    status === 401 ||
    status === 403 ||
    lower.includes('api_key_invalid') ||
    lower.includes('invalid api key') ||
    lower.includes('authentication') ||
    lower.includes('unauthorized') ||
    lower.includes('permission_denied')
  ) {
    return new AiServiceError({
      message: `${provider ? provider.toUpperCase() : 'AI'} authentication failed. Verify the configured API key in Settings > Secrets.`,
      statusCode: 502,
      category: 'auth_error',
      retryable: false,
      switchProviderAllowed: false,
      provider,
    });
  }

  // Permanent Invalid / Malformed Request (400 / 404 / 422 prompt or schema error)
  if (
    status === 400 ||
    status === 404 ||
    status === 422 ||
    lower.includes('invalid argument') ||
    lower.includes('not_found') ||
    lower.includes('malformed')
  ) {
    return new AiServiceError({
      message: `${provider ? provider.toUpperCase() : 'AI'} rejected request parameters: ${sanitizeProviderMessage(msg)}`,
      statusCode: 400,
      category: 'invalid_request',
      retryable: false,
      switchProviderAllowed: false,
      provider,
    });
  }

  // Rate limits (HTTP 429)
  if (
    status === 429 ||
    lower.includes('429') ||
    lower.includes('rate limit') ||
    lower.includes('resource_exhausted') ||
    lower.includes('resource exhausted') ||
    lower.includes('too many requests')
  ) {
    return new AiServiceError({
      message: `${provider ? provider.toUpperCase() : 'AI'} rate limit exceeded (429).`,
      statusCode: 429,
      category: 'rate_limit',
      retryable: true,
      switchProviderAllowed: true,
      provider,
      retryAfterMs,
    });
  }

  // Timeouts (504 / ETIMEDOUT / AbortError)
  if (
    status === 504 ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNABORTED' ||
    err?.name === 'AbortError' ||
    lower.includes('timeout') ||
    lower.includes('timed out')
  ) {
    return new AiServiceError({
      message: `${provider ? provider.toUpperCase() : 'AI'} request timed out.`,
      statusCode: 504,
      category: 'timeout',
      retryable: true,
      switchProviderAllowed: true,
      provider,
      retryAfterMs,
    });
  }

  // Transient network interruptions
  if (
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN' ||
    code === 'EPIPE' ||
    lower.includes('fetch failed') ||
    lower.includes('network') ||
    lower.includes('socket hang up') ||
    lower.includes('connection interrupted')
  ) {
    return new AiServiceError({
      message: `${provider ? provider.toUpperCase() : 'AI'} network interruption occurred.`,
      statusCode: 503,
      category: 'network_error',
      retryable: true,
      switchProviderAllowed: true,
      provider,
      retryAfterMs,
    });
  }

  // Transient 5xx server overload / outage (500, 502, 503)
  if (
    status === 500 ||
    status === 502 ||
    status === 503 ||
    lower.includes('503') ||
    lower.includes('502') ||
    lower.includes('500') ||
    lower.includes('overloaded') ||
    lower.includes('service unavailable') ||
    lower.includes('internal server error')
  ) {
    return new AiServiceError({
      message: `${provider ? provider.toUpperCase() : 'AI'} temporary service overload (${status || 503}).`,
      statusCode: status || 503,
      category: 'server_error',
      retryable: true,
      switchProviderAllowed: true,
      provider,
      retryAfterMs,
    });
  }

  return new AiServiceError({
    message: sanitizeProviderMessage(msg),
    statusCode: status || 500,
    category: 'unknown',
    retryable: false,
    switchProviderAllowed: true,
    provider,
  });
}
