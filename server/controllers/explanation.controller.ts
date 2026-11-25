import { Request, Response } from 'express';
import { explanationService } from '../services/explanation.service';

export class ExplanationController {
  public async generateExplanation(req: Request, res: Response) {
    try {
      const { concept, mode, context } = req.body;
      if (!concept) {
        return res.status(400).json({ error: 'Concept parameter is required.' });
      }

      const result = await explanationService.generateExplanation({
        concept,
        mode: mode || 'socratic',
        context,
      });

      res.json(result);
    } catch (error: any) {
      console.error('ExplanationController Error:', error);
      res.status(500).json({ error: 'Failed to generate explanation using Gemini' });
    }
  }
}

export const explanationController = new ExplanationController();
