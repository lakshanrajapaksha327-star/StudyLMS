import { Request, Response, NextFunction } from 'express';
import { ApiError, isValidResourceId } from '../middleware/validate.middleware';
import { getAuthContext, makeSafeId } from '../repositories/base.repository';
import { workspaceRepository } from '../repositories/workspace.repository';
import { quizService } from '../services/quiz.service';

export class QuizController {
  public async generateQuiz(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const {
        topic,
        sourceContent,
        questionCount,
        difficulty,
        questionFormat,
        notebookId,
        selectedDocumentIds,
      } = req.body;
      const quiz = await quizService.generateAndSave(
        {
          topic,
          sourceContent,
          questionCount,
          difficulty,
          questionFormat,
          notebookId,
          selectedDocumentIds,
        },
        auth
      );
      res.json({ success: true, questions: quiz.questions, quiz });
    } catch (err) {
      next(err);
    }
  }

  public async evaluateAnswer(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { question, expectedAnswer, studentAnswer } = req.body || {};
      if (!question || !studentAnswer || !String(studentAnswer).trim()) {
        throw new ApiError(400, 'Question and studentAnswer are required.');
      }
      const evaluation = await quizService.evaluateShortAnswer(
        {
          question: String(question),
          expectedAnswer: String(expectedAnswer || ''),
          studentAnswer: String(studentAnswer),
        },
        auth
      );
      res.json({ success: true, evaluation });
    } catch (err) {
      next(err);
    }
  }

  public async saveQuiz(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const body = req.body;
      const quiz = await quizService.saveOrUpdateQuiz(
        {
          ...body,
          id: body.id && isValidResourceId(body.id) ? body.id : makeSafeId('quiz'),
          userId: auth.userId,
          notebookId: body.notebookId || 'nb-default',
          createdAt: body.createdAt || new Date().toISOString(),
        },
        auth
      );
      res.json({ success: true, quiz });
    } catch (err) {
      next(err);
    }
  }

  public async getQuizzes(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const notebookId = typeof req.query.notebookId === 'string' ? req.query.notebookId : undefined;
      const quizzes = await quizService.getQuizzes(auth, notebookId);
      res.json({ success: true, quizzes });
    } catch (err) {
      next(err);
    }
  }

  public async getQuizById(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      if (!isValidResourceId(req.params.id)) throw new ApiError(400, 'Invalid quiz ID.');
      const quiz = await quizService.getQuizById(req.params.id, auth);
      if (!quiz) throw new ApiError(404, 'Quiz not found.', 'NOT_FOUND');
      res.json({ success: true, quiz });
    } catch (err) {
      next(err);
    }
  }

  public async submitAttempt(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const {
        quizSetId,
        quizTitle,
        score,
        scorePercent,
        totalQuestions,
        correctCount,
        timeTakenSeconds,
        answers,
      } = req.body;

      if (!quizSetId || !isValidResourceId(quizSetId)) {
        throw new ApiError(400, 'Valid quizSetId is required.');
      }

      const attempt = await workspaceRepository.saveQuizAttempt(
        {
          quizSetId,
          quizTitle,
          score: Number(score) || 0,
          scorePercent: Number(scorePercent) || 0,
          totalQuestions: Number(totalQuestions) || 0,
          correctCount: Number(correctCount) || 0,
          timeTakenSeconds: Number(timeTakenSeconds) || 0,
          answers: answers || {},
        },
        auth
      );

      // Update quiz best score if applicable
      const quiz = await quizService.getQuizById(quizSetId, auth);
      if (quiz && (Number(scorePercent) || 0) > (quiz.bestScore || 0)) {
        await quizService.saveOrUpdateQuiz(
          { ...quiz, bestScore: Number(scorePercent) || 0 },
          auth
        );
      }

      await workspaceRepository
        .addActivityLog(
          {
            type: 'quiz_completed',
            title: quizTitle || quiz?.title || 'Practice Quiz',
            details: `${correctCount}/${totalQuestions} correct`,
            score: `${Math.round(Number(scorePercent) || 0)}%`,
          },
          auth
        )
        .catch(() => {});

      res.status(201).json({ success: true, attempt });
    } catch (err) {
      next(err);
    }
  }

  public async getAttempts(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const attempts = await workspaceRepository.getQuizAttempts(auth);
      res.json({ success: true, attempts });
    } catch (err) {
      next(err);
    }
  }

  public async deleteQuiz(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      if (!isValidResourceId(req.params.id)) throw new ApiError(400, 'Invalid quiz ID.');
      const success = await quizService.deleteQuiz(req.params.id, auth);
      if (!success) throw new ApiError(404, 'Quiz not found.', 'NOT_FOUND');
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}

export const quizController = new QuizController();
