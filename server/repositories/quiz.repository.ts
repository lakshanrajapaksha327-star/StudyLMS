import { QuizSetModel } from '../models/quiz.model';

class QuizRepository {
  private quizzes: Map<string, QuizSetModel> = new Map();

  public async saveQuiz(quiz: QuizSetModel): Promise<QuizSetModel> {
    this.quizzes.set(quiz.id, quiz);
    return quiz;
  }

  public async findQuizById(id: string): Promise<QuizSetModel | undefined> {
    return this.quizzes.get(id);
  }

  public async findAllQuizzes(): Promise<QuizSetModel[]> {
    return Array.from(this.quizzes.values());
  }

  public async deleteQuiz(id: string): Promise<boolean> {
    return this.quizzes.delete(id);
  }
}

export const quizRepository = new QuizRepository();
