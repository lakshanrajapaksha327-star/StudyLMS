import { AiErrorCategory, AiProviderId } from './ai-errors';

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface ProviderCircuitSnapshot {
  state: CircuitState;
  cooldownRemainingMs: number;
  lastLatencyMs: number | null;
  recentFailureRate: number;
  totalRequests: number;
  totalFailures: number;
  lastErrorCategory: AiErrorCategory | null;
  lastCheckedAt: string | null;
}

interface ProviderMetricsBucket {
  state: CircuitState;
  consecutiveFailures: number;
  openedAt: number | null;
  halfOpenProbeRunning: boolean;
  recentOutcomes: boolean[]; // true = success, false = failure (sliding window of 10)
  totalRequests: number;
  totalFailures: number;
  lastLatencyMs: number | null;
  lastErrorCategory: AiErrorCategory | null;
  lastCheckedAt: string | null;
}

export class CircuitBreakerService {
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly windowSize = 10;
  private readonly buckets = new Map<AiProviderId, ProviderMetricsBucket>();

  constructor(opts?: { failureThreshold?: number; cooldownMs?: number }) {
    this.failureThreshold = opts?.failureThreshold ?? 3;
    this.cooldownMs = opts?.cooldownMs ?? 30_000;
  }

  private getBucket(provider: AiProviderId): ProviderMetricsBucket {
    let b = this.buckets.get(provider);
    if (!b) {
      b = {
        state: 'closed',
        consecutiveFailures: 0,
        openedAt: null,
        halfOpenProbeRunning: false,
        recentOutcomes: [],
        totalRequests: 0,
        totalFailures: 0,
        lastLatencyMs: null,
        lastErrorCategory: null,
        lastCheckedAt: null,
      };
      this.buckets.set(provider, b);
    }
    return b;
  }

  public canExecute(provider: AiProviderId): boolean {
    const b = this.getBucket(provider);
    if (b.state === 'closed') return true;

    if (b.state === 'open') {
      const elapsed = b.openedAt ? Date.now() - b.openedAt : 0;
      if (elapsed >= this.cooldownMs) {
        b.state = 'half_open';
        b.halfOpenProbeRunning = true;
        return true;
      }
      return false;
    }

    // half_open: allow a single probe at a time
    if (!b.halfOpenProbeRunning) {
      b.halfOpenProbeRunning = true;
      return true;
    }
    return false;
  }

  public recordSuccess(provider: AiProviderId, latencyMs: number): void {
    const b = this.getBucket(provider);
    b.totalRequests += 1;
    b.consecutiveFailures = 0;
    b.state = 'closed';
    b.openedAt = null;
    b.halfOpenProbeRunning = false;
    b.lastLatencyMs = latencyMs;
    b.lastErrorCategory = null;
    b.lastCheckedAt = new Date().toISOString();
    b.recentOutcomes.push(true);
    if (b.recentOutcomes.length > this.windowSize) b.recentOutcomes.shift();
  }

  public recordFailure(
    provider: AiProviderId,
    category: AiErrorCategory,
    latencyMs?: number
  ): void {
    const b = this.getBucket(provider);
    b.totalRequests += 1;
    b.totalFailures += 1;
    b.lastCheckedAt = new Date().toISOString();
    if (typeof latencyMs === 'number') b.lastLatencyMs = latencyMs;
    b.lastErrorCategory = category;

    b.recentOutcomes.push(false);
    if (b.recentOutcomes.length > this.windowSize) b.recentOutcomes.shift();

    // Never trip circuit breaker for invalid user prompt errors (400/malformed_output)
    const countsTowardOutage =
      category === 'rate_limit' ||
      category === 'server_error' ||
      category === 'timeout' ||
      category === 'network_error' ||
      category === 'auth_error';

    if (!countsTowardOutage) {
      b.halfOpenProbeRunning = false;
      return;
    }

    b.consecutiveFailures += 1;
    b.halfOpenProbeRunning = false;

    if (b.state === 'half_open' || b.consecutiveFailures >= this.failureThreshold) {
      b.state = 'open';
      b.openedAt = Date.now();
    }
  }

  public getSnapshot(provider: AiProviderId): ProviderCircuitSnapshot {
    const b = this.getBucket(provider);
    let currentState = b.state;
    let cooldownRemainingMs = 0;

    if (currentState === 'open' && b.openedAt !== null) {
      const remaining = this.cooldownMs - (Date.now() - b.openedAt);
      if (remaining <= 0) {
        currentState = 'half_open';
        cooldownRemainingMs = 0;
      } else {
        cooldownRemainingMs = remaining;
      }
    }

    const recentFailures = b.recentOutcomes.filter((ok) => !ok).length;
    const recentFailureRate =
      b.recentOutcomes.length > 0
        ? Number((recentFailures / b.recentOutcomes.length).toFixed(2))
        : 0;

    return {
      state: currentState,
      cooldownRemainingMs,
      lastLatencyMs: b.lastLatencyMs,
      recentFailureRate,
      totalRequests: b.totalRequests,
      totalFailures: b.totalFailures,
      lastErrorCategory: b.lastErrorCategory,
      lastCheckedAt: b.lastCheckedAt,
    };
  }

  public reset(provider?: AiProviderId): void {
    if (provider) {
      this.buckets.delete(provider);
    } else {
      this.buckets.clear();
    }
  }
}

export const circuitBreakerService = new CircuitBreakerService();
