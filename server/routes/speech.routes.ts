import { Router } from 'express';
import { speechController } from '../controllers/speech.controller';

const router = Router();
router.post('/speech', (req, res, next) => speechController.generateSpeech(req, res, next));
export default router;
