import { firestoreRest } from '../config/firestore_rest';
import { QuizSetModel } from '../models/quiz.model';
import { AuthContext, pickAllowedKeys } from './base.repository';

const QUIZ_SET_KEYS = [
  'id',
  'userId',
  'notebookId',
  'title',
  'description',
  'difficulty',
  'bestScore',
  'questions',
  'groundingMode',
  'sourceDocumentIds',
  'sourceCitations',
  'createdAt',
  'updatedAt',
] as const;

export class QuizRepository {
  public async saveQuiz(quiz: QuizSetModel, auth: AuthContext): Promise<QuizSetModel> {
    const now = new Date().toISOString();
    const payload: QuizSetModel = {
      ...quiz,
      userId: auth.userId,
      notebookId: (quiz.notebookId || 'nb-default').replace(/[^a-zA-Z0-9_\-]/g, '-'),
      questions: (quiz.questions || []).slice(0, 200),
      createdAt: quiz.createdAt || now,
      updatedAt: now,
    };
    const clean = pickAllowedKeys(payload, QUIZ_SET_KEYS) as QuizSetModel;
    return firestoreRest.setDoc('quiz_sets', clean.id, clean, auth.idToken);
  }

  public async findQuizById(id: string, auth: AuthContext): Promise<QuizSetModel | undefined> {
    const quiz = await firestoreRest.getDoc<QuizSetModel>('quiz_sets', id, auth.idToken);
    if (!quiz || quiz.userId !== auth.userId) return undefined;
    return quiz;
  }

  public async findAllQuizzes(auth: AuthContext, notebookId?: string): Promise<QuizSetModel[]> {
    const list = await firestoreRest.listByUser<QuizSetModel>(
      'quiz_sets',
      auth.userId,
      auth.idToken
    );
    const filtered = notebookId ? list.filter((q) => q.notebookId === notebookId) : list;
    return filtered.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  public async deleteQuiz(id: string, auth: AuthContext): Promise<boolean> {
    const existing = await this.findQuizById(id, auth);
    if (!existing) return false;
    return firestoreRest.deleteDoc('quiz_sets', id, auth.idToken);
  }
}

export const quizRepository = new QuizRepository();
