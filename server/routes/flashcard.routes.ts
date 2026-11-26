import { Router } from 'express';
import { flashcardController } from '../controllers/flashcard.controller';

const router = Router();

router.post('/generate-flashcards', (req, res, next) =>
  flashcardController.generateFlashcards(req, res, next)
);
router.post('/flashcard-sets', (req, res, next) =>
  flashcardController.saveSet(req, res, next)
);
router.patch('/flashcard-sets/:id', (req, res, next) =>
  flashcardController.updateSet(req, res, next)
);
router.get('/flashcard-sets', (req, res, next) => flashcardController.getSets(req, res, next));
router.get('/flashcard-sets/:id', (req, res, next) =>
  flashcardController.getSetById(req, res, next)
);
router.delete('/flashcard-sets/:id', (req, res, next) =>
  flashcardController.deleteSet(req, res, next)
);

export default router;
