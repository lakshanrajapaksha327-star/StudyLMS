import { GenerateQuizRequest, QuizSetModel } from '../models/quiz.model';
import { AuthContext, makeSafeId } from '../repositories/base.repository';
import { quizRepository } from '../repositories/quiz.repository';
import { workspaceRepository } from '../repositories/workspace.repository';
import { geminiService } from './gemini.service';
import { ragService } from './rag.service';

export class QuizService {
  public async generateAndSave(
    request: GenerateQuizRequest,
    auth: AuthContext
  ): Promise<QuizSetModel> {
    const {
      topic = 'General Exam Practice',
      sourceContent = '',
      questionCount = 5,
      difficulty = 'medium',
      questionFormat = 'mixed',
      notebookId,
      selectedDocumentIds,
    } = request;

    const resolvedNbId =
      notebookId && notebookId.trim()
        ? notebookId.trim()
        : (await workspaceRepository.ensureDefaultNotebook(auth)).id;

    let combinedSource = sourceContent;
    if (!combinedSource.trim()) {
      const rag = await ragService.retrieveContext({
        query: topic,
        auth,
        notebookId: resolvedNbId,
        selectedDocumentIds,
        topK: 10,
      });
      if (rag.hasEvidence) {
        combinedSource = rag.formattedContext;
      }
    }

    const questionsData = await geminiService.generateQuiz(
      topic,
      combinedSource,
      questionCount,
      difficulty,
      auth,
      questionFormat
    );

    const quizId = makeSafeId('quiz');
    const now = new Date().toISOString();

    const questions = questionsData.map((q: any, idx: number) => ({
      id: `q-${quizId}-${idx + 1}`,
      type: (q.type as any) || 'multiple-choice',
      question: q.question || 'Question',
      options: Array.isArray(q.options) ? q.options : [],
      ...(Array.isArray(q.matchingPairs) && q.matchingPairs.length > 0
        ? { matchingPairs: q.matchingPairs }
        : {}),
      correctAnswer: q.correctAnswer || '',
      explanation: q.explanation || 'Answer rationale verified against study materials.',
    }));

    const quizModel: QuizSetModel = {
      id: quizId,
      userId: auth.userId,
      notebookId: resolvedNbId,
      title: topic,
      description: `AI-generated practice test (${questions.length} questions, ${difficulty}, ${questionFormat})`,
      difficulty,
      questions,
      createdAt: now,
      updatedAt: now,
      bestScore: 0,
    };

    return quizRepository.saveQuiz(quizModel, auth);
  }

  public async evaluateShortAnswer(
    params: { question: string; expectedAnswer: string; studentAnswer: string },
    auth: AuthContext
  ) {
    return geminiService.evaluateShortAnswer({ ...params, auth });
  }

  public async saveOrUpdateQuiz(quiz: QuizSetModel, auth: AuthContext): Promise<QuizSetModel> {
    return quizRepository.saveQuiz(quiz, auth);
  }

  public async getQuizzes(auth: AuthContext, notebookId?: string): Promise<QuizSetModel[]> {
    return quizRepository.findAllQuizzes(auth, notebookId);
  }

  public async getQuizById(id: string, auth: AuthContext): Promise<QuizSetModel | undefined> {
    return quizRepository.findQuizById(id, auth);
  }

  public async deleteQuiz(id: string, auth: AuthContext): Promise<boolean> {
    return quizRepository.deleteQuiz(id, auth);
  }
}

export const quizService = new QuizService();
