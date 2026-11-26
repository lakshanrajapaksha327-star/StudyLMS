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
      ...entry,
      userId: auth.userId,
      id: makeSafeId('ailog'),
      prompt: (entry.prompt || '').slice(0, 1900),
      response: (entry.response || '').slice(0, 1900),
      createdAt: new Date().toISOString(),
    };
    if (log.inputTokens === null || log.inputTokens === undefined) delete log.inputTokens;
    if (log.outputTokens === null || log.outputTokens === undefined) delete log.outputTokens;
    if (!log.errorCategory) delete log.errorCategory;

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

  public async getAllLogsAdmin(auth: AuthContext): Promise<AiPromptLogModel[]> {
    const logs = await firestoreRest.listAllAdmin<AiPromptLogModel>('ai_usage_logs', auth.idToken);
    return logs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  public async getStats(auth: AuthContext) {
    const logs = await this.getLogsByUserId(auth);
    const totalTokens = logs.reduce((acc, l) => acc + (l.tokensConsumed || 0), 0);
    const totalCost = logs.reduce((acc, l) => acc + (l.costUsd || 0), 0);
    const avgLatency =
      logs.length > 0
        ? Math.round(logs.reduce((acc, l) => acc + (l.latencyMs || 0), 0) / logs.length)
        : 0;

    return {
      totalRequests: logs.length,
      totalTokens,
      totalCostUsd: Number(totalCost.toFixed(6)),
      avgLatencyMs: avgLatency,
    };
  }
}

export const aiPromptRepository = new AiPromptRepository();
