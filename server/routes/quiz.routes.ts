import { Router } from 'express';
import { quizController } from '../controllers/quiz.controller';

const router = Router();

router.post('/generate-quiz', (req, res) => quizController.generateQuiz(req, res));
router.get('/quizzes', (req, res) => quizController.getQuizzes(req, res));
router.get('/quizzes/:id', (req, res) => quizController.getQuizById(req, res));
router.delete('/quizzes/:id', (req, res) => quizController.deleteQuiz(req, res));

export default router;
