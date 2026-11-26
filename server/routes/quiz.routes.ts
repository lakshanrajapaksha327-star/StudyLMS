import { Router } from 'express';
import { quizController } from '../controllers/quiz.controller';

const router = Router();

router.post('/generate-quiz', (req, res, next) => quizController.generateQuiz(req, res, next));
router.post('/quizzes/evaluate-answer', (req, res, next) =>
  quizController.evaluateAnswer(req, res, next)
);
router.post('/quizzes', (req, res, next) => quizController.saveQuiz(req, res, next));
router.post('/quizzes/attempts', (req, res, next) => quizController.submitAttempt(req, res, next));
router.get('/quizzes/attempts', (req, res, next) => quizController.getAttempts(req, res, next));
router.get('/quizzes', (req, res, next) => quizController.getQuizzes(req, res, next));
router.get('/quizzes/:id', (req, res, next) => quizController.getQuizById(req, res, next));
router.delete('/quizzes/:id', (req, res, next) => quizController.deleteQuiz(req, res, next));

export default router;
