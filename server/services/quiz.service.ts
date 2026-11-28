import { ApiError } from '../middleware/validate.middleware';
import {
  GenerateQuizRequest,
  QuizSetModel,
  QuizSourceCitationRef,
} from '../models/quiz.model';
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
      sourceMode: explicitMode,
      questionCount = 5,
      difficulty = 'medium',
      questionFormat = 'mixed',
      notebookId,
      selectedDocumentIds = [],
    } = request;

    const sourceMode: 'document' | 'note' | 'topic' =
      explicitMode ||
      (selectedDocumentIds.length > 0
        ? 'document'
        : sourceContent.trim()
        ? 'note'
        : 'topic');

    const resolvedNbId =
      notebookId && notebookId.trim()
        ? notebookId.trim()
        : (await workspaceRepository.ensureDefaultNotebook(auth)).id;

    let combinedSource = '';
    let groundingMode: 'source_grounded' | 'general_knowledge' = 'general_knowledge';
    let sourceCitations: QuizSourceCitationRef[] = [];

    if (sourceMode === 'document') {
      if (!selectedDocumentIds || selectedDocumentIds.length === 0) {
        throw new ApiError(400, 'Select at least one document in Document mode.', 'NO_DOCUMENTS_SELECTED');
      }

      const rag = await ragService.retrieveContext({
        query: topic?.trim() || 'core concepts, mechanisms, definitions, formulas, and testable facts',
        auth,
        notebookId: resolvedNbId,
        selectedDocumentIds,
        topK: 12,
        maxContextTokens: 7500,
      });

      if (rag.hasEvidence) {
        combinedSource = rag.formattedContext;
        groundingMode = 'source_grounded';
        sourceCitations = rag.citations.slice(0, 8).map((c) => ({
          documentId: c.documentId,
          documentTitle: c.documentTitle,
          chunkId: c.chunkId,
          pageNumber: c.pageNumber,
          slideNumber: c.slideNumber,
        }));
      } else {
        const ordered = await ragService.getOrderedChunksForDocuments(
          auth,
          selectedDocumentIds,
          resolvedNbId
        );
        if (ordered.chunks.length === 0) {
          throw new ApiError(
            422,
            'Selected document(s) have no indexed study chunks yet. Please re-index or retry processing before generating a quiz.',
            'NO_INDEXED_CHUNKS'
          );
        }
        const slice = ordered.chunks
          .slice(0, 12)
          .map((chunk) => ({ chunk, score: 1 }));
        const formatted = ragService.formatChunksAsContext(slice, ordered.docMap);
        combinedSource = formatted.formattedContext;
        groundingMode = 'source_grounded';
        sourceCitations = formatted.citations.slice(0, 8).map((c) => ({
          documentId: c.documentId,
          documentTitle: c.documentTitle,
          chunkId: c.chunkId,
          pageNumber: c.pageNumber,
          slideNumber: c.slideNumber,
        }));
      }
    } else if (sourceMode === 'note') {
      if (!sourceContent.trim()) {
        throw new ApiError(400, 'Selected study note is empty.', 'NO_NOTE_CONTENT');
      }
      combinedSource = sourceContent;
      groundingMode = 'source_grounded';
    } else {
      if (sourceContent.trim()) {
        combinedSource = sourceContent;
        groundingMode = 'source_grounded';
      } else {
        const rag = await ragService.retrieveContext({
          query: topic,
          auth,
          notebookId: resolvedNbId,
          selectedDocumentIds: selectedDocumentIds.length > 0 ? selectedDocumentIds : undefined,
          topK: 10,
        });
        if (rag.hasEvidence) {
          combinedSource = rag.formattedContext;
          groundingMode = 'source_grounded';
          sourceCitations = rag.citations.slice(0, 8).map((c) => ({
            documentId: c.documentId,
            documentTitle: c.documentTitle,
            chunkId: c.chunkId,
            pageNumber: c.pageNumber,
            slideNumber: c.slideNumber,
          }));
        }
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
      question: q.question,
      options: Array.isArray(q.options) ? q.options : [],
      ...(Array.isArray(q.matchingPairs) && q.matchingPairs.length > 0
        ? { matchingPairs: q.matchingPairs }
        : {}),
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || 'Answer rationale verified against study materials.',
    }));

    const quizModel: QuizSetModel = {
      id: quizId,
      userId: auth.userId,
      notebookId: resolvedNbId,
      title: topic,
      description: `AI-generated practice test (${questions.length} questions, ${difficulty}, ${questionFormat}, ${groundingMode === 'source_grounded' ? 'source grounded' : 'general knowledge'})`,
      difficulty,
      questions,
      createdAt: now,
      updatedAt: now,
      bestScore: 0,
      groundingMode,
      sourceDocumentIds: selectedDocumentIds.length > 0 ? selectedDocumentIds : undefined,
      sourceCitations: sourceCitations.length > 0 ? sourceCitations : undefined,
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
