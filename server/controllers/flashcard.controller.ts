import { Request, Response } from 'express';
import { flashcardService } from '../services/flashcard.service';

export class FlashcardController {
  public async generateFlashcards(req: Request, res: Response) {
    try {
      const { topic, sourceContent, cardCount, notebookId } = req.body;
      const set = await flashcardService.generateAndSave({
        topic,
        sourceContent,
        cardCount,
        notebookId,
      });

      res.json({ cards: set.cards, set });
    } catch (error: any) {
      console.error('FlashcardController Error:', error);
      res.status(500).json({ error: 'Failed to generate flashcards using Gemini' });
    }
  }

  public async getSets(req: Request, res: Response) {
    try {
      const sets = await flashcardService.getSets();
      res.json({ success: true, sets });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to retrieve flashcard sets' });
    }
  }

  public async getSetById(req: Request, res: Response) {
    try {
      const set = await flashcardService.getSetById(req.params.id);
      if (!set) return res.status(404).json({ error: 'Flashcard set not found' });
      res.json({ success: true, set });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to retrieve flashcard set' });
    }
  }

  public async deleteSet(req: Request, res: Response) {
    try {
      const success = await flashcardService.deleteSet(req.params.id);
      res.json({ success });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to delete flashcard set' });
    }
  }
}

export const flashcardController = new FlashcardController();
