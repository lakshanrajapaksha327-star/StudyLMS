import { Request, Response, NextFunction } from 'express';
import { ApiError, isValidResourceId } from '../middleware/validate.middleware';
import { getAuthContext, makeSafeId } from '../repositories/base.repository';
import { flashcardService } from '../services/flashcard.service';

export class FlashcardController {
  public async generateFlashcards(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { topic, sourceContent, cardCount, notebookId, selectedDocumentIds } = req.body;
      const set = await flashcardService.generateAndSave(
        { topic, sourceContent, cardCount, notebookId, selectedDocumentIds },
        auth
      );
      res.json({ success: true, cards: set.cards, set });
    } catch (err) {
      next(err);
    }
  }

  public async saveSet(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const body = req.body;
      const set = await flashcardService.saveOrUpdateSet(
        {
          ...body,
          id: body.id && isValidResourceId(body.id) ? body.id : makeSafeId('fcset'),
          userId: auth.userId,
          notebookId: body.notebookId || 'nb-default',
          createdAt: body.createdAt || new Date().toISOString(),
        },
        auth
      );
      res.json({ success: true, set });
    } catch (err) {
      next(err);
    }
  }

  public async updateSet(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      if (!isValidResourceId(req.params.id)) throw new ApiError(400, 'Invalid flashcard set ID.');
      const existing = await flashcardService.getSetById(req.params.id, auth);
      if (!existing) throw new ApiError(404, 'Flashcard set not found.', 'NOT_FOUND');

      const merged = {
        ...existing,
        ...req.body,
        id: existing.id,
        userId: auth.userId,
        createdAt: existing.createdAt,
      };
      const updated = await flashcardService.saveOrUpdateSet(merged, auth);
      res.json({ success: true, set: updated });
    } catch (err) {
      next(err);
    }
  }

  public async getSets(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const notebookId = typeof req.query.notebookId === 'string' ? req.query.notebookId : undefined;
      const sets = await flashcardService.getSets(auth, notebookId);
      res.json({ success: true, sets });
    } catch (err) {
      next(err);
    }
  }

  public async getSetById(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      if (!isValidResourceId(req.params.id)) throw new ApiError(400, 'Invalid flashcard set ID.');
      const set = await flashcardService.getSetById(req.params.id, auth);
      if (!set) throw new ApiError(404, 'Flashcard set not found.', 'NOT_FOUND');
      res.json({ success: true, set });
    } catch (err) {
      next(err);
    }
  }

  public async deleteSet(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      if (!isValidResourceId(req.params.id)) throw new ApiError(400, 'Invalid flashcard set ID.');
      const success = await flashcardService.deleteSet(req.params.id, auth);
      if (!success) throw new ApiError(404, 'Flashcard set not found.', 'NOT_FOUND');
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}

export const flashcardController = new FlashcardController();
