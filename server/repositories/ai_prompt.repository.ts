import { firestoreRest } from '../config/firestore_rest';
import { AiPromptLogModel } from '../models/ai_prompt.model';
import { AuthContext, makeSafeId, pickAllowedKeys } from './base.repository';

const AI_LOG_KEYS = [
  'id',
  'userId',
  'feature',
  'provider',
  'prompt',
  'response',
  'latencyMs',
  'inputTokens',
  'outputTokens',
  'costUsd',
  'tokensConsumed',
  'modelName',
  'status',
  'errorCategory',
  'cached',
  'fallbackUsed',
  'createdAt',
] as const;

export class AiPromptRepository {
  public async logPrompt(
    entry: Omit<AiPromptLogModel, 'id' | 'createdAt'>,
    auth: AuthContext
  ): Promise<AiPromptLogModel> {
    const log: Record<string, any> = {
      userId: auth.userId,
      id: makeSafeId('ailog'),
      feature: entry.feature,
      provider: entry.provider || 'gemini',
      latencyMs: entry.latencyMs,
      tokensConsumed: entry.tokensConsumed ?? 0,
      modelName: entry.modelName,
      status: entry.status || 'success',
      cached: Boolean(entry.cached),
      fallbackUsed: Boolean(entry.fallbackUsed),
      createdAt: new Date().toISOString(),
    };
    if (typeof entry.inputTokens === 'number') log.inputTokens = entry.inputTokens;
    if (typeof entry.outputTokens === 'number') log.outputTokens = entry.outputTokens;
    if (typeof entry.costUsd === 'number') log.costUsd = entry.costUsd;
    if (entry.errorCategory) log.errorCategory = entry.errorCategory;

    const clean = pickAllowedKeys(log, AI_LOG_KEYS) as AiPromptLogModel;
    return firestoreRest.setDoc('ai_usage_logs', clean.id, clean, auth.idToken);
  }

  public async getLogsByUserId(auth: AuthContext): Promise<AiPromptLogModel[]> {
    const logs = await firestoreRest.listByUser<AiPromptLogModel>(
      'ai_usage_logs',
      auth.userId,
      auth.idToken
    );
    return logs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  public async clearLogsForUser(auth: AuthContext): Promise<number> {
    const logs = await this.getLogsByUserId(auth);
    for (const item of logs) {
      await firestoreRest.deleteDoc('ai_usage_logs', item.id, auth.idToken).catch(() => {});
    }
    return logs.length;
  }

  public async getAllLogsAdmin(auth: AuthContext): Promise<AiPromptLogModel[]> {
    const logs = await firestoreRest.listAllAdmin<AiPromptLogModel>('ai_usage_logs', auth.idToken);
    return logs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  public async getStats(auth: AuthContext) {
    const logs = await this.getLogsByUserId(auth);
    const totalTokens = logs.reduce((acc, l) => acc + (l.tokensConsumed || 0), 0);
    const knownCostLogs = logs.filter((l) => typeof l.costUsd === 'number');
    const totalCost =
      knownCostLogs.length > 0
        ? Number(knownCostLogs.reduce((acc, l) => acc + (l.costUsd || 0), 0).toFixed(6))
        : null;
    const avgLatency =
      logs.length > 0
        ? Math.round(logs.reduce((acc, l) => acc + (l.latencyMs || 0), 0) / logs.length)
        : 0;

    return {
      totalRequests: logs.length,
      totalTokens,
      totalCostUsd: totalCost,
      avgLatencyMs: avgLatency,
    };
  }
}

export const aiPromptRepository = new AiPromptRepository();
