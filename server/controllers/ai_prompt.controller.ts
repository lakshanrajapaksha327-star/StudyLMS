import { Request, Response, NextFunction } from 'express';
import { modelRegistry } from '../ai/model-registry';
import { ApiError } from '../middleware/validate.middleware';
import { aiPromptRepository } from '../repositories/ai_prompt.repository';
import { getAuthContext } from '../repositories/base.repository';
import { userPreferencesRepository } from '../repositories/user_preferences.repository';

export class AiPromptController {
  public async getLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const [logs, stats] = await Promise.all([
        aiPromptRepository.getLogsByUserId(auth),
        aiPromptRepository.getStats(auth),
      ]);
      res.json({ success: true, logs, stats });
    } catch (err) {
      next(err);
    }
  }

  public async logPrompt(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const prefs = await userPreferencesRepository.getByUserId(auth).catch(() => null);
      if (prefs?.privacyMode) {
        return res.status(200).json({ success: true, skippedByPrivacyMode: true });
      }

      const {
        feature,
        latencyMs = 0,
        costUsd = null,
        tokensConsumed = 0,
        modelName = modelRegistry.resolveModelForProvider('gemini', 'simple_text'),
      } = req.body;

      if (!feature) throw new ApiError(400, 'Feature name is required.');

      const parsedCost =
        typeof costUsd === 'number' && Number.isFinite(costUsd) ? costUsd : null;

      const log = await aiPromptRepository.logPrompt(
        {
          userId: auth.userId,
          feature: String(feature),
          latencyMs: Number(latencyMs) || 0,
          costUsd: parsedCost,
          tokensConsumed: Number(tokensConsumed) || 0,
          modelName: String(modelName),
        },
        auth
      );
      res.status(201).json({ success: true, log });
    } catch (err) {
      next(err);
    }
  }

  public async clearLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const deletedCount = await aiPromptRepository.clearLogsForUser(auth);
      res.json({ success: true, deletedCount });
    } catch (err) {
      next(err);
    }
  }
}

export const aiPromptController = new AiPromptController();
