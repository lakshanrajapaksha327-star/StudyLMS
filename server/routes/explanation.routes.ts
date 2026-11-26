import { Router } from 'express';
import { explanationController } from '../controllers/explanation.controller';

const router = Router();
router.post('/explanation', (req, res, next) =>
  explanationController.generateExplanation(req, res, next)
);
export default router;
