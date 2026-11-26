import { Request, Response, NextFunction } from 'express';
import { DEFAULT_TEXT_MODEL } from '../config/ai_provider';
import { ApiError } from '../middleware/validate.middleware';
import { aiPromptRepository } from '../repositories/ai_prompt.repository';
import { getAuthContext } from '../repositories/base.repository';

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
      const {
        feature,
        prompt,
        response,
        latencyMs = 0,
        costUsd = 0,
        tokensConsumed = 0,
        modelName = DEFAULT_TEXT_MODEL,
      } = req.body;

      if (!feature) throw new ApiError(400, 'Feature name is required.');

      const log = await aiPromptRepository.logPrompt(
        {
          userId: auth.userId,
          feature,
          prompt: prompt || '',
          response: response || '',
          latencyMs: Number(latencyMs) || 0,
          costUsd: Number(costUsd) || 0,
          tokensConsumed: Number(tokensConsumed) || 0,
          modelName,
        },
        auth
      );
      res.status(201).json({ success: true, log });
    } catch (err) {
      next(err);
    }
  }
}

export const aiPromptController = new AiPromptController();
