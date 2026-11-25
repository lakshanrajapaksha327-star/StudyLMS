import { Router } from 'express';
import { explanationController } from '../controllers/explanation.controller';

const router = Router();

router.post('/explanation', (req, res) =>
  explanationController.generateExplanation(req, res)
);

export default router;
