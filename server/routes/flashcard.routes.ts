import { Router } from 'express';
import { flashcardController } from '../controllers/flashcard.controller';

const router = Router();

router.post('/generate-flashcards', (req, res) =>
  flashcardController.generateFlashcards(req, res)
);
router.get('/flashcard-sets', (req, res) => flashcardController.getSets(req, res));
router.get('/flashcard-sets/:id', (req, res) => flashcardController.getSetById(req, res));
router.delete('/flashcard-sets/:id', (req, res) => flashcardController.deleteSet(req, res));

export default router;
