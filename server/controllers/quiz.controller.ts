import { Request, Response } from 'express';
import { quizService } from '../services/quiz.service';

export class QuizController {
  public async generateQuiz(req: Request, res: Response) {
    try {
      const { topic, sourceContent, questionCount, notebookId } = req.body;
      const quiz = await quizService.generateAndSave({
        topic,
        sourceContent,
        questionCount,
        notebookId,
      });

      res.json({ questions: quiz.questions, quiz });
    } catch (error: any) {
      console.error('QuizController Error:', error);
      res.status(500).json({ error: 'Failed to generate practice quiz using Gemini' });
    }
  }

  public async getQuizzes(req: Request, res: Response) {
    try {
      const quizzes = await quizService.getQuizzes();
      res.json({ success: true, quizzes });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to retrieve quizzes' });
    }
  }

  public async getQuizById(req: Request, res: Response) {
    try {
      const quiz = await quizService.getQuizById(req.params.id);
      if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
      res.json({ success: true, quiz });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to retrieve quiz' });
    }
  }

  public async deleteQuiz(req: Request, res: Response) {
    try {
      const success = await quizService.deleteQuiz(req.params.id);
      res.json({ success });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to delete quiz' });
    }
  }
}

export const quizController = new QuizController();
