import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../middleware/validate.middleware';
import { getAuthContext } from '../repositories/base.repository';
import { explanationService } from '../services/explanation.service';

export class ExplanationController {
  public async generateExplanation(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { concept, mode, context } = req.body;
      if (!concept || !String(concept).trim()) {
        throw new ApiError(400, 'Concept parameter is required.');
      }

      const result = await explanationService.generateExplanation(
        {
          concept: String(concept),
          mode: mode || 'socratic',
          context,
        },
        auth
      );

      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
}

export const explanationController = new ExplanationController();
