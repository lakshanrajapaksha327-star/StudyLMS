import { AiPromptLogModel } from '../models/ai_prompt.model';

class AiPromptRepository {
  private logs: AiPromptLogModel[] = [];

  public async logPrompt(data: Omit<AiPromptLogModel, 'id' | 'createdAt'>): Promise<AiPromptLogModel> {
    const log: AiPromptLogModel = {
      ...data,
      id: `ai-log-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      createdAt: new Date().toISOString(),
    };
    this.logs.unshift(log); // Most recent first
    return log;
  }

  public async getLogsByUserId(userId: string, limit = 50): Promise<AiPromptLogModel[]> {
    return this.logs.filter((l) => l.userId === userId || !l.userId).slice(0, limit);
  }

  public async getStats(): Promise<{
    totalPrompts: number;
    totalTokens: number;
    totalCostUsd: number;
    avgLatencyMs: number;
  }> {
    const totalPrompts = this.logs.length;
    const totalTokens = this.logs.reduce((sum, l) => sum + (l.tokensConsumed || 0), 0);
    const totalCostUsd = this.logs.reduce((sum, l) => sum + (l.costUsd || 0), 0);
    const avgLatencyMs =
      totalPrompts > 0
        ? Math.round(this.logs.reduce((sum, l) => sum + (l.latencyMs || 0), 0) / totalPrompts)
        : 0;

    return { totalPrompts, totalTokens, totalCostUsd, avgLatencyMs };
  }
}

export const aiPromptRepository = new AiPromptRepository();
