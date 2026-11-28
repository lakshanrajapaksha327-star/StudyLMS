import { AiProviderId } from './ai-errors';
import { AiProviderAdapter, AiTaskType } from './ai-provider.interface';
import { CircuitBreakerService } from './circuit-breaker.service';
import { modelRegistry } from './model-registry';

export interface RouteCandidate {
  adapter: AiProviderAdapter;
  model: string;
  isPrimary: boolean;
}

export class AiRouterService {
  public buildProviderOrder(
    adapters: Map<AiProviderId, AiProviderAdapter>,
    taskType: AiTaskType,
    preferredModel?: string,
    circuitBreaker?: CircuitBreakerService,
    preferredProvider?: AiProviderId
  ): RouteCandidate[] {
    const primaryId = preferredProvider || modelRegistry.getPrimaryProviderId();
    const fallbackId = modelRegistry.getFallbackProviderId();
    const allIds: AiProviderId[] = ['gemini', 'openai', 'anthropic'];

    // Ordered preference: configured primary (or preferredProvider) -> fallback -> remaining providers
    const orderedIds: AiProviderId[] = [primaryId];
    if (!orderedIds.includes(fallbackId)) orderedIds.push(fallbackId);
    for (const id of allIds) {
      if (!orderedIds.includes(id)) orderedIds.push(id);
    }

    const candidates: RouteCandidate[] = [];

    for (const id of orderedIds) {
      const adapter = adapters.get(id);
      if (!adapter) continue;
      // Never route to unconfigured providers — accurately treat them as unavailable
      if (!adapter.isConfigured()) continue;
      if (!adapter.supportsTask(taskType)) continue;
      if (circuitBreaker && !circuitBreaker.canExecute(id)) continue;

      const model =
        id === 'gemini'
          ? adapter.getConfiguredModel(taskType, preferredModel)
          : adapter.getConfiguredModel(taskType);

      candidates.push({
        adapter,
        model,
        isPrimary: id === primaryId,
      });
    }

    return candidates;
  }
}

export const aiRouterService = new AiRouterService();
