import { GenerateQuizRequest, QuizSetModel } from '../models/quiz.model';
import { geminiService } from './gemini.service';
import { quizRepository } from '../repositories/quiz.repository';

export class QuizService {
  public async generateAndSave(request: GenerateQuizRequest): Promise<QuizSetModel> {
    const { topic = 'General Exam Practice', sourceContent = '', questionCount = 4, notebookId } = request;

    const questionsData = await geminiService.generateQuiz(topic, sourceContent, questionCount);

    const quizId = `quiz-set-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const questions = questionsData.map((q: any, idx: number) => ({
      id: `q-${quizId}-${idx + 1}`,
      type: q.type || 'multiple-choice',
      question: q.question || 'Question',
      options: q.options || [],
      correctAnswer: q.correctAnswer || '',
      explanation: q.explanation || 'Answer rationale',
    }));

    const quizModel: QuizSetModel = {
      id: quizId,
      notebookId,
      title: topic,
      description: `AI-generated practice test with ${questions.length} questions`,
      questions,
      createdAt: new Date().toISOString(),
      bestScore: 0,
    };

    await quizRepository.saveQuiz(quizModel);

    return quizModel;
  }

  public async getQuizzes(): Promise<QuizSetModel[]> {
    return quizRepository.findAllQuizzes();
  }

  public async getQuizById(id: string): Promise<QuizSetModel | undefined> {
    return quizRepository.findQuizById(id);
  }

  public async deleteQuiz(id: string): Promise<boolean> {
    return quizRepository.deleteQuiz(id);
  }
}

export const quizService = new QuizService();
