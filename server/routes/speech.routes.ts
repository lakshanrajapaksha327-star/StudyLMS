import { Router } from 'express';
import { speechController } from '../controllers/speech.controller';

const router = Router();

router.post('/speech', (req, res) => speechController.generateSpeech(req, res));

export default router;
