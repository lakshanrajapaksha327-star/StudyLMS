import { Request, Response } from 'express';
import { aiPromptRepository } from '../repositories/ai_prompt.repository';

export class AiPromptController {
  public async getLogs(req: Request, res: Response) {
    try {
      const userId = (req.query.userId as string) || '1';
      const logs = await aiPromptRepository.getLogsByUserId(userId);
      const stats = await aiPromptRepository.getStats();
      res.json({ success: true, logs, stats });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to retrieve AI prompt logs' });
    }
  }

  public async logPrompt(req: Request, res: Response) {
    try {
      const { userId = '1', feature, prompt, response, latencyMs = 0, costUsd = 0, tokensConsumed = 0, modelName = 'gemini-3.6-flash' } = req.body;
      const log = await aiPromptRepository.logPrompt({
        userId,
        feature,
        prompt,
        response,
        latencyMs,
        costUsd,
        tokensConsumed,
        modelName,
      });
      res.json({ success: true, log });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to log AI prompt request' });
    }
  }
}

export const aiPromptController = new AiPromptController();
