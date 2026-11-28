import { Request, Response, NextFunction } from 'express';
import { aiManagerService } from '../ai/ai-manager.service';
import { firestoreRest } from '../config/firestore_rest';
import { ApiError, isValidResourceId } from '../middleware/validate.middleware';
import { aiPromptRepository } from '../repositories/ai_prompt.repository';
import { advancedLearningRepository } from '../repositories/advanced_learning.repository';
import { getAuthContext, makeSafeId } from '../repositories/base.repository';
import { chatHistoryRepository } from '../repositories/chat_history.repository';
import { chunkRepository } from '../repositories/chunk.repository';
import { documentRepository } from '../repositories/document.repository';
import { flashcardRepository } from '../repositories/flashcard.repository';
import { quizRepository } from '../repositories/quiz.repository';
import { searchHistoryRepository } from '../repositories/search_history.repository';
import { studyPlannerRepository } from '../repositories/study_planner.repository';
import { userPreferencesRepository } from '../repositories/user_preferences.repository';
import { workspaceRepository } from '../repositories/workspace.repository';
import { documentService } from '../services/document.service';

export class WorkspaceController {
  // ---------------- AUTH SESSION & BOOTSTRAP ----------------
  public async getSession(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const [profile, preferences] = await Promise.all([
        workspaceRepository.ensureUserProfile(auth, req.user?.name, req.user?.avatar),
        userPreferencesRepository.getByUserId(auth),
      ]);
      res.json({
        success: true,
        user: {
          ...profile,
          role: auth.role === 'Admin' ? 'Admin' : profile.role,
        },
        preferences,
      });
    } catch (err) {
      next(err);
    }
  }

  public async updateSessionProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { name, avatar, studyGoalMinutes, cardsMastered, quizzesCompleted, timeSpentMinutes, streakDays } =
        req.body || {};

      const updated = await workspaceRepository.updateUserProfile(auth, {
        ...(typeof name === 'string' && name.trim() ? { name: name.trim().slice(0, 120) } : {}),
        ...(typeof avatar === 'string' ? { avatar: avatar.slice(0, 2000) } : {}),
        ...(typeof studyGoalMinutes === 'number' ? { studyGoalMinutes } : {}),
        ...(typeof cardsMastered === 'number' ? { cardsMastered } : {}),
        ...(typeof quizzesCompleted === 'number' ? { quizzesCompleted } : {}),
        ...(typeof timeSpentMinutes === 'number' ? { timeSpentMinutes } : {}),
        ...(typeof streakDays === 'number' ? { streakDays } : {}),
      });

      res.json({ success: true, user: updated });
    } catch (err) {
      next(err);
    }
  }

  public async bootstrapWorkspace(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const [profile, preferences, notebooks, documents, notes, flashcardSets, quizSets, quizAttempts, chatSessions, studyPlans, tasks, notifications, activityLogs] =
        await Promise.all([
          workspaceRepository.ensureUserProfile(auth, req.user?.name, req.user?.avatar),
          userPreferencesRepository.getByUserId(auth),
          workspaceRepository.getNotebooks(auth),
          documentRepository.findAll(auth),
          workspaceRepository.getNotes(auth),
          flashcardRepository.findAllSets(auth),
          quizRepository.findAllQuizzes(auth),
          workspaceRepository.getQuizAttempts(auth),
          chatHistoryRepository.getAllSessions(auth),
          studyPlannerRepository.getAllPlans(auth),
          workspaceRepository.getTasks(auth),
          workspaceRepository.getNotifications(auth),
          workspaceRepository.getActivityLogs(auth),
        ]);

      let ensuredNotebooks = notebooks;
      if (ensuredNotebooks.length === 0) {
        const defaultNb = await workspaceRepository.ensureDefaultNotebook(auth);
        ensuredNotebooks = [defaultNb];
      }

      res.json({
        success: true,
        user: {
          ...profile,
          role: auth.role === 'Admin' ? 'Admin' : profile.role,
        },
        preferences,
        notebooks: ensuredNotebooks,
        documents,
        notes,
        flashcardSets,
        quizSets,
        quizAttempts,
        chatSessions,
        studyPlans,
        tasks,
        notifications,
        activityLogs,
      });
    } catch (err) {
      next(err);
    }
  }

  // ---------------- NOTEBOOKS ----------------
  public async getNotebooks(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      let notebooks = await workspaceRepository.getNotebooks(auth);
      if (notebooks.length === 0) {
        notebooks = [await workspaceRepository.ensureDefaultNotebook(auth)];
      }
      res.json({ success: true, notebooks });
    } catch (err) {
      next(err);
    }
  }

  public async saveNotebook(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { id, title, description, color, createdAt } = req.body || {};
      if (!title || !String(title).trim()) throw new ApiError(400, 'Notebook title is required.');
      const now = new Date().toISOString();
      const nb = await workspaceRepository.saveNotebook(
        {
          id: id && isValidResourceId(id) ? id : makeSafeId('nb'),
          userId: auth.userId,
          title: String(title).trim().slice(0, 200),
          description: typeof description === 'string' ? description.slice(0, 1900) : '',
          color: typeof color === 'string' ? color : 'from-indigo-600 to-purple-600',
          createdAt: createdAt || now,
          updatedAt: now,
        },
        auth
      );
      res.json({ success: true, notebook: nb });
    } catch (err) {
      next(err);
    }
  }

  public async deleteNotebook(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const targetId = req.params.id;
      if (!isValidResourceId(targetId)) throw new ApiError(400, 'Invalid notebook ID.');

      const notebooks = await workspaceRepository.getNotebooks(auth);
      const exists = notebooks.find((n) => n.id === targetId);
      if (!exists) throw new ApiError(404, 'Notebook not found.', 'NOT_FOUND');

      if (notebooks.length <= 1) {
        throw new ApiError(
          400,
          'You must keep at least one study notebook in your workspace.'
        );
      }

      const fallbackNb = notebooks.find((n) => n.id !== targetId)!;
      const cascade = req.query.cascade === 'true';

      // Safely reassign or cascade child items so zero orphaned references remain
      const [docs, notes, decks, quizzes, sessions] = await Promise.all([
        documentRepository.findAll(auth, targetId),
        workspaceRepository.getNotes(auth, targetId),
        flashcardRepository.findAllSets(auth, targetId),
        quizRepository.findAllQuizzes(auth, targetId),
        chatHistoryRepository.getAllSessions(auth),
      ]);

      for (const doc of docs) {
        if (cascade) {
          await documentService.deleteDocument(doc.id, auth).catch(() => {});
        } else {
          await documentRepository.patch(doc.id, { notebookId: fallbackNb.id }, auth).catch(() => {});
        }
      }
      for (const note of notes) {
        if (cascade) {
          await workspaceRepository.deleteNote(note.id, auth).catch(() => {});
        } else {
          await workspaceRepository.saveNote({ ...note, notebookId: fallbackNb.id }, auth, false).catch(() => {});
        }
      }
      for (const deck of decks) {
        if (cascade) {
          await flashcardRepository.deleteSet(deck.id, auth).catch(() => {});
        } else {
          await flashcardRepository.saveSet({ ...deck, notebookId: fallbackNb.id }, auth).catch(() => {});
        }
      }
      for (const quiz of quizzes) {
        if (cascade) {
          await quizRepository.deleteQuiz(quiz.id, auth).catch(() => {});
        } else {
          await quizRepository.saveQuiz({ ...quiz, notebookId: fallbackNb.id }, auth).catch(() => {});
        }
      }
      for (const s of sessions.filter((cs) => cs.notebookId === targetId)) {
        if (cascade) {
          await chatHistoryRepository.deleteSession(s.id, auth).catch(() => {});
        } else {
          await chatHistoryRepository.saveSession({ ...s, notebookId: fallbackNb.id }, auth).catch(() => {});
        }
      }

      const success = await workspaceRepository.deleteNotebook(targetId, auth);
      if (!success) throw new ApiError(404, 'Notebook not found.', 'NOT_FOUND');
      res.json({ success: true, fallbackNotebookId: cascade ? null : fallbackNb.id });
    } catch (err) {
      next(err);
    }
  }

  // ---------------- STUDY NOTES & VERSIONS ----------------
  public async getNotes(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const notebookId = typeof req.query.notebookId === 'string' ? req.query.notebookId : undefined;
      const notes = await workspaceRepository.getNotes(auth, notebookId);
      res.json({ success: true, notes });
    } catch (err) {
      next(err);
    }
  }

  public async saveNote(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { id, notebookId, title, content, tags, aiGenerated, createdAt, saveVersion } =
        req.body || {};
      if (!title || !String(title).trim()) throw new ApiError(400, 'Note title is required.');

      const resolvedNbId =
        notebookId && isValidResourceId(notebookId)
          ? notebookId
          : (await workspaceRepository.ensureDefaultNotebook(auth)).id;

      const note = await workspaceRepository.saveNote(
        {
          id: id && isValidResourceId(id) ? id : makeSafeId('note'),
          userId: auth.userId,
          notebookId: resolvedNbId,
          title: String(title).trim().slice(0, 290),
          content: typeof content === 'string' ? content : '',
          tags: Array.isArray(tags) ? tags : [],
          aiGenerated: Boolean(aiGenerated),
          createdAt: createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        auth,
        saveVersion !== false
      );
      res.json({ success: true, note });
    } catch (err) {
      next(err);
    }
  }

  public async getNoteVersions(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      if (!isValidResourceId(req.params.id)) throw new ApiError(400, 'Invalid note ID.');
      const versions = await workspaceRepository.getNoteVersions(req.params.id, auth);
      res.json({ success: true, versions });
    } catch (err) {
      next(err);
    }
  }

  public async deleteNote(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      if (!isValidResourceId(req.params.id)) throw new ApiError(400, 'Invalid note ID.');
      const success = await workspaceRepository.deleteNote(req.params.id, auth);
      if (!success) throw new ApiError(404, 'Note not found.', 'NOT_FOUND');
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  // ---------------- STUDY TASKS ----------------
  public async getTasks(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const tasks = await workspaceRepository.getTasks(auth);
      res.json({ success: true, tasks });
    } catch (err) {
      next(err);
    }
  }

  public async saveTask(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { id, title, subject, scheduledDate, durationMinutes, completed, priority, taskType, createdAt } =
        req.body || {};
      if (!title || !String(title).trim()) throw new ApiError(400, 'Task title is required.');

      const task = await workspaceRepository.saveTask(
        {
          id: id && isValidResourceId(id) ? id : makeSafeId('task'),
          userId: auth.userId,
          title: String(title).trim().slice(0, 290),
          subject: typeof subject === 'string' ? subject.slice(0, 100) : undefined,
          scheduledDate: typeof scheduledDate === 'string' ? scheduledDate : undefined,
          durationMinutes: typeof durationMinutes === 'number' ? durationMinutes : 25,
          completed: Boolean(completed),
          priority: priority === 'high' || priority === 'low' ? priority : 'medium',
          taskType: typeof taskType === 'string' ? taskType : 'study',
          createdAt: createdAt || new Date().toISOString(),
        },
        auth
      );
      res.json({ success: true, task });
    } catch (err) {
      next(err);
    }
  }

  public async deleteTask(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      if (!isValidResourceId(req.params.id)) throw new ApiError(400, 'Invalid task ID.');
      const success = await workspaceRepository.deleteTask(req.params.id, auth);
      if (!success) throw new ApiError(404, 'Task not found.', 'NOT_FOUND');
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  // ---------------- NOTIFICATIONS ----------------
  public async getNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const notifications = await workspaceRepository.getNotifications(auth);
      res.json({ success: true, notifications });
    } catch (err) {
      next(err);
    }
  }

  public async markNotificationRead(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      if (!isValidResourceId(req.params.id)) throw new ApiError(400, 'Invalid notification ID.');
      const updated = await workspaceRepository.markNotificationRead(req.params.id, auth);
      if (!updated) throw new ApiError(404, 'Notification not found.', 'NOT_FOUND');
      res.json({ success: true, notification: updated });
    } catch (err) {
      next(err);
    }
  }

  public async deleteNotification(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      if (!isValidResourceId(req.params.id)) throw new ApiError(400, 'Invalid notification ID.');
      const success = await workspaceRepository.deleteNotification(req.params.id, auth);
      if (!success) throw new ApiError(404, 'Notification not found.', 'NOT_FOUND');
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  // ---------------- ACTIVITY LOGS ----------------
  public async getActivityLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const logs = await workspaceRepository.getActivityLogs(auth);
      res.json({ success: true, logs });
    } catch (err) {
      next(err);
    }
  }

  public async clearActivityLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      await workspaceRepository.clearActivityLogs(auth);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  // ---------------- DOCUMENT ANNOTATIONS ----------------
  public async getAnnotations(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const documentId =
        typeof req.query.documentId === 'string' && isValidResourceId(req.query.documentId)
          ? req.query.documentId
          : undefined;
      const annotations = await workspaceRepository.getAnnotations(auth, documentId);
      res.json({ success: true, annotations });
    } catch (err) {
      next(err);
    }
  }

  public async saveAnnotation(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { id, documentId, notebookId, pageNumber, content, type, createdAt } = req.body || {};
      if (!documentId || !isValidResourceId(documentId)) {
        throw new ApiError(400, 'Valid documentId is required.');
      }
      if (!content || !String(content).trim()) {
        throw new ApiError(400, 'Annotation content is required.');
      }
      const resolvedNbId =
        notebookId && isValidResourceId(notebookId)
          ? notebookId
          : (await workspaceRepository.ensureDefaultNotebook(auth)).id;

      const annotation = await workspaceRepository.saveAnnotation(
        {
          id: id && isValidResourceId(id) ? id : makeSafeId('annot'),
          userId: auth.userId,
          documentId,
          notebookId: resolvedNbId,
          pageNumber: typeof pageNumber === 'number' ? pageNumber : 1,
          content: String(content).trim().slice(0, 3900),
          type:
            type === 'highlight' || type === 'bookmark' ? type : 'sticky_note',
          createdAt: createdAt || new Date().toISOString(),
        },
        auth
      );
      res.status(201).json({ success: true, annotation });
    } catch (err) {
      next(err);
    }
  }

  public async deleteAnnotation(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      if (!isValidResourceId(req.params.id)) throw new ApiError(400, 'Invalid annotation ID.');
      const deleted = await workspaceRepository.deleteAnnotation(req.params.id, auth);
      if (!deleted) throw new ApiError(404, 'Annotation not found.', 'NOT_FOUND');
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  // ---------------- GLOBAL DATABASE SEARCH ----------------
  public async globalSearch(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const category = typeof req.query.type === 'string' ? req.query.type.toLowerCase() : 'all';
      if (!q) {
        const recent = await searchHistoryRepository.getRecentSearches(auth, 10);
        return res.json({ success: true, results: [], recentSearches: recent });
      }

      const ql = q.toLowerCase();
      const [notebooks, documents, notes, flashcardSets, quizSets, chatSessions] = await Promise.all([
        workspaceRepository.getNotebooks(auth),
        documentRepository.findAll(auth),
        workspaceRepository.getNotes(auth),
        flashcardRepository.findAllSets(auth),
        quizRepository.findAllQuizzes(auth),
        chatHistoryRepository.getAllSessions(auth),
      ]);

      const chunks =
        category === 'all' || category === 'documents' || category === 'chunks'
          ? await chunkRepository.getChunksForDocuments(documents.slice(0, 30), auth)
          : [];

      interface SearchHit {
        id: string;
        category: 'notebook' | 'document' | 'chunk' | 'note' | 'flashcard' | 'quiz' | 'chat';
        title: string;
        snippet: string;
        notebookId?: string;
        documentId?: string;
        meta?: string;
      }

      const hits: SearchHit[] = [];

      const buildSnippet = (text: string): string => {
        const idx = text.toLowerCase().indexOf(ql);
        if (idx === -1) return text.slice(0, 140);
        const start = Math.max(0, idx - 45);
        const end = Math.min(text.length, idx + ql.length + 85);
        return `${start > 0 ? '...' : ''}${text.slice(start, end)}${end < text.length ? '...' : ''}`;
      };

      if (category === 'all' || category === 'notebooks') {
        notebooks.forEach((nb) => {
          if (nb.title.toLowerCase().includes(ql) || (nb.description || '').toLowerCase().includes(ql)) {
            hits.push({
              id: nb.id,
              category: 'notebook',
              title: nb.title,
              snippet: nb.description || 'Study notebook workspace',
              notebookId: nb.id,
            });
          }
        });
      }

      if (category === 'all' || category === 'documents') {
        documents.forEach((doc) => {
          const hay = `${doc.title} ${doc.summary || ''} ${(doc.keyConcepts || []).join(' ')} ${doc.content || ''}`;
          if (hay.toLowerCase().includes(ql)) {
            hits.push({
              id: doc.id,
              category: 'document',
              title: doc.title,
              snippet: buildSnippet(doc.summary || doc.content || doc.title),
              notebookId: doc.notebookId,
              documentId: doc.id,
              meta: `${doc.type.toUpperCase()}${doc.pageCount ? ` • ${doc.pageCount} pages` : ''}`,
            });
          }
        });
      }

      if (category === 'all' || category === 'documents' || category === 'chunks') {
        chunks.forEach((chunk) => {
          if (chunk.content.toLowerCase().includes(ql)) {
            hits.push({
              id: chunk.id,
              category: 'chunk',
              title: chunk.sourceTitle || 'Document Passage',
              snippet: buildSnippet(chunk.content),
              notebookId: chunk.notebookId,
              documentId: chunk.documentId,
              meta: chunk.pageNumber
                ? `Page ${chunk.pageNumber}`
                : chunk.slideNumber
                ? `Slide ${chunk.slideNumber}`
                : chunk.sectionHeading || 'Excerpt',
            });
          }
        });
      }

      if (category === 'all' || category === 'notes') {
        notes.forEach((n) => {
          if (
            n.title.toLowerCase().includes(ql) ||
            n.content.toLowerCase().includes(ql) ||
            (n.tags || []).some((t) => t.toLowerCase().includes(ql))
          ) {
            hits.push({
              id: n.id,
              category: 'note',
              title: n.title,
              snippet: buildSnippet(n.content),
              notebookId: n.notebookId,
              meta: (n.tags || []).slice(0, 3).join(', '),
            });
          }
        });
      }

      if (category === 'all' || category === 'flashcards') {
        flashcardSets.forEach((set) => {
          const matchedCard = set.cards.find(
            (c) => c.question.toLowerCase().includes(ql) || c.answer.toLowerCase().includes(ql)
          );
          if (set.title.toLowerCase().includes(ql) || matchedCard) {
            hits.push({
              id: set.id,
              category: 'flashcard',
              title: set.title,
              snippet: matchedCard
                ? `${matchedCard.question} -> ${matchedCard.answer.slice(0, 80)}`
                : `${set.cards.length} flashcards in deck`,
              notebookId: set.notebookId,
              meta: `${set.cards.length} cards`,
            });
          }
        });
      }

      if (category === 'all' || category === 'quizzes') {
        quizSets.forEach((qz) => {
          const matchedQ = qz.questions.find((qq) => qq.question.toLowerCase().includes(ql));
          if (qz.title.toLowerCase().includes(ql) || matchedQ) {
            hits.push({
              id: qz.id,
              category: 'quiz',
              title: qz.title,
              snippet: matchedQ ? matchedQ.question : `${qz.questions.length} quiz questions`,
              notebookId: qz.notebookId,
              meta: `${qz.questions.length} Qs`,
            });
          }
        });
      }

      if (category === 'all' || category === 'chats') {
        chatSessions.forEach((cs) => {
          const matchedMsg = cs.messages.find((m) => m.text.toLowerCase().includes(ql));
          if (cs.title.toLowerCase().includes(ql) || matchedMsg) {
            hits.push({
              id: cs.id,
              category: 'chat',
              title: cs.title,
              snippet: matchedMsg ? buildSnippet(matchedMsg.text) : `${cs.messages.length} messages`,
              notebookId: cs.notebookId,
              meta: cs.persona,
            });
          }
        });
      }

      const validCategory =
        category === 'documents' ||
        category === 'flashcards' ||
        category === 'quizzes' ||
        category === 'notes' ||
        category === 'chats'
          ? category
          : 'all';

      void searchHistoryRepository
        .recordSearch(q, validCategory, hits.length, auth)
        .catch(() => {});

      const recentSearches = await searchHistoryRepository.getRecentSearches(auth, 8).catch(() => []);

      res.json({
        success: true,
        results: hits.slice(0, 60),
        total: hits.length,
        recentSearches,
      });
    } catch (err) {
      next(err);
    }
  }

  // ---------------- WORKSPACE DATA EXPORT, IMPORT & ACCOUNT DELETION ----------------
  public async exportWorkspaceData(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const [
        profile,
        preferences,
        notebooks,
        documents,
        notes,
        flashcardSets,
        quizSets,
        quizAttempts,
        chatSessions,
        studyPlans,
        tasks,
        annotations,
        studySessions,
        diagrams,
        examPrepGuides,
        topicMasteries,
        audioLectures,
      ] = await Promise.all([
        workspaceRepository.ensureUserProfile(auth),
        userPreferencesRepository.getByUserId(auth),
        workspaceRepository.getNotebooks(auth),
        documentRepository.findAll(auth),
        workspaceRepository.getNotes(auth),
        flashcardRepository.findAllSets(auth),
        quizRepository.findAllQuizzes(auth),
        workspaceRepository.getQuizAttempts(auth),
        chatHistoryRepository.getAllSessions(auth),
        studyPlannerRepository.getAllPlans(auth),
        workspaceRepository.getTasks(auth),
        workspaceRepository.getAnnotations(auth),
        advancedLearningRepository.getStudySessions(auth),
        advancedLearningRepository.getDiagrams(auth),
        advancedLearningRepository.getExamPrepGuides(auth),
        advancedLearningRepository.getTopicMasteries(auth),
        advancedLearningRepository.getAudioLectures(auth),
      ]);

      res.json({
        success: true,
        exportedAt: new Date().toISOString(),
        workspace: {
          profile,
          preferences,
          notebooks,
          documents: documents.map((d) => ({ ...d, content: d.content?.slice(0, 40000) })),
          notes,
          flashcardSets,
          quizSets,
          quizAttempts,
          chatSessions,
          studyPlans,
          tasks,
          annotations,
          studySessions,
          diagrams,
          examPrepGuides,
          topicMasteries,
          audioLectures,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  public async importWorkspaceItems(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { kind, notebookId, title, cards, notes } = req.body || {};
      const resolvedNbId =
        notebookId && isValidResourceId(notebookId)
          ? notebookId
          : (await workspaceRepository.ensureDefaultNotebook(auth)).id;

      if (kind === 'flashcards') {
        if (!Array.isArray(cards) || cards.length === 0) {
          throw new ApiError(400, 'At least one valid flashcard { question, answer } is required.');
        }
        const normalizedCards = cards
          .filter((c: any) => c && String(c.question || '').trim() && String(c.answer || '').trim())
          .slice(0, 200)
          .map((c: any, idx: number) => ({
            id: makeSafeId(`impcard-${idx}`),
            question: String(c.question).trim().slice(0, 1500),
            answer: String(c.answer).trim().slice(0, 3000),
            hint: c.hint ? String(c.hint).trim().slice(0, 500) : undefined,
            status: 'unstudied' as const,
            box: 1,
            easeFactor: 2.5,
            intervalDays: 0,
            repetitions: 0,
            nextReviewDate: new Date().toISOString().split('T')[0],
          }));

        if (normalizedCards.length === 0) {
          throw new ApiError(400, 'No valid flashcard rows found in import payload.');
        }

        const deck = await flashcardRepository.saveSet(
          {
            id: makeSafeId('fcset'),
            userId: auth.userId,
            notebookId: resolvedNbId,
            title: String(title || 'Imported Flashcard Deck').trim().slice(0, 280),
            description: `Imported ${normalizedCards.length} flashcards`,
            category: 'Imported',
            cards: normalizedCards,
            createdAt: new Date().toISOString(),
          },
          auth
        );
        return res.status(201).json({ success: true, importedCount: normalizedCards.length, flashcardSet: deck });
      }

      if (kind === 'notes') {
        const items = Array.isArray(notes) ? notes : [];
        if (items.length === 0) {
          throw new ApiError(400, 'At least one note { title, content } is required.');
        }
        const createdNotes = [];
        for (const item of items.slice(0, 50)) {
          const noteTitle = String(item?.title || title || 'Imported Study Note').trim().slice(0, 290);
          const noteContent = String(item?.content || '');
          if (!noteContent.trim()) continue;
          const saved = await workspaceRepository.saveNote(
            {
              id: makeSafeId('note'),
              userId: auth.userId,
              notebookId: resolvedNbId,
              title: noteTitle,
              content: noteContent.slice(0, 295000),
              tags: Array.isArray(item?.tags) ? item.tags.slice(0, 15) : ['imported'],
              aiGenerated: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            auth,
            true
          );
          createdNotes.push(saved);
        }
        if (createdNotes.length === 0) {
          throw new ApiError(400, 'No non-empty notes found to import.');
        }
        return res.status(201).json({ success: true, importedCount: createdNotes.length, notes: createdNotes });
      }

      throw new ApiError(400, 'Invalid import kind. Supported: "flashcards", "notes".');
    } catch (err) {
      next(err);
    }
  }

  public async deleteAccountData(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      await workspaceRepository.deleteAllUserWorkspaceData(auth);
      res.json({ success: true, message: 'All workspace data removed.' });
    } catch (err) {
      next(err);
    }
  }

  // ---------------- ADMIN ANALYTICS & MANAGEMENT ----------------
  public async getAdminOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const [users, logs, userDocs, aiLogs] = await Promise.all([
        workspaceRepository.listAllUsersAdmin(auth),
        workspaceRepository.getActivityLogs(auth),
        documentRepository.findAll(auth),
        aiPromptRepository.getAllLogsAdmin(auth).catch(() => []),
      ]);

      let totalTokens = 0;
      let totalLatencyMs = 0;
      const errorLogs = aiLogs.filter((l) => l.status === 'error');
      for (const logItem of aiLogs) {
        totalTokens += logItem.tokensConsumed || 0;
        totalLatencyMs += logItem.latencyMs || 0;
      }
      const avgLatencyMs = aiLogs.length > 0 ? Math.round(totalLatencyMs / aiLogs.length) : 0;

      const aiMonitoring = aiManagerService.getMonitoringOverview();
      const anyHealthy = aiMonitoring.providers.some((p) => p.status === 'healthy');

      res.json({
        success: true,
        metrics: {
          totalUsers: users.length,
          activeToday: users.filter((u) => u.status !== 'Suspended').length,
          aiTokensUsed: totalTokens,
          aiRequestsTotal: aiLogs.length,
          aiErrorsTotal: errorLogs.length,
          avgAiLatencyMs: avgLatencyMs,
          documentsIndexed: userDocs.filter(
            (d) => d.processingStatus === 'ready' || d.processingStatus === 'partially_processed'
          ).length,
          systemHealth: anyHealthy ? 'Healthy' : 'Degraded',
        },
        users: users.map((u) => ({
          id: u.uid,
          name: u.name,
          email: u.email,
          role: u.role,
          status: u.status || 'Active',
          cardsMastered: u.cardsMastered || 0,
          quizzesCompleted: u.quizzesCompleted || 0,
          createdAt: u.createdAt,
        })),
        aiMonitoring,
        recentAiErrors: errorLogs.slice(0, 15).map((e) => ({
          id: e.id,
          feature: e.feature,
          provider: e.provider || 'gemini',
          modelName: e.modelName,
          errorCategory: e.errorCategory || 'unknown',
          message: `${e.errorCategory || 'error'} (${e.modelName})`,
          createdAt: e.createdAt,
        })),
        recentEventsCount: logs.length,
      });
    } catch (err) {
      next(err);
    }
  }

  public async probeAdminDiagnostics(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const fsStart = Date.now();
      let firestoreState: 'connection_verified' | 'auth_failure' | 'temporarily_unavailable' =
        'connection_verified';
      let firestoreMessage = 'Authenticated Firestore read succeeded.';

      try {
        await firestoreRest.listAllAdmin('users', auth.idToken, 1);
      } catch (fsErr: any) {
        if (fsErr?.statusCode === 401 || fsErr?.statusCode === 403) {
          firestoreState = 'auth_failure';
        } else {
          firestoreState = 'temporarily_unavailable';
        }
        firestoreMessage = fsErr?.message || 'Firestore probe failed.';
      }

      const providers = await aiManagerService.probeProviders();
      res.json({
        success: true,
        checkedAt: new Date().toISOString(),
        firestore: {
          state: firestoreState,
          latencyMs: Date.now() - fsStart,
          message: firestoreMessage,
          config: firestoreRest.getConfigInfo(),
        },
        providers,
      });
    } catch (err) {
      next(err);
    }
  }

  public async adminUpdateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const targetUid = req.params.uid;
      if (!isValidResourceId(targetUid)) throw new ApiError(400, 'Invalid user ID.');
      const { role, status } = req.body || {};

      const updates: { role?: 'Student' | 'Educator' | 'Admin'; status?: 'Active' | 'Suspended' } =
        {};
      if (role === 'Student' || role === 'Educator' || role === 'Admin') updates.role = role;
      if (status === 'Active' || status === 'Suspended') updates.status = status;

      if (!updates.role && !updates.status) {
        throw new ApiError(400, 'Provide valid role or status to update.');
      }

      const updated = await workspaceRepository.adminUpdateUser(targetUid, updates, auth);
      if (!updated) throw new ApiError(404, 'User not found.', 'NOT_FOUND');
      res.json({ success: true, user: updated });
    } catch (err) {
      next(err);
    }
  }

  public async adminDeleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const targetUid = req.params.uid;
      if (!isValidResourceId(targetUid)) throw new ApiError(400, 'Invalid user ID.');
      if (targetUid === auth.userId) {
        throw new ApiError(400, 'Use Account Settings to delete your own active account.');
      }
      const deleted = await workspaceRepository.adminDeleteUser(targetUid, auth);
      if (!deleted) throw new ApiError(404, 'User not found.', 'NOT_FOUND');
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  // ---------------- ONE-TIME LOCALSTORAGE MIGRATION ----------------
  public async migrateLocalData(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { notebooks = [], sources = [], notes = [], flashcardSets = [], quizSets = [] } =
        req.body || {};

      let importedNotebooks = 0;
      let importedSources = 0;
      let importedNotes = 0;
      let importedDecks = 0;
      let importedQuizzes = 0;

      const nbIdMap = new Map<string, string>();

      for (const nb of notebooks) {
        if (!nb?.title) continue;
        const safeId = nb.id && isValidResourceId(nb.id) ? nb.id : makeSafeId('nb');
        nbIdMap.set(nb.id || safeId, safeId);
        await workspaceRepository.saveNotebook(
          {
            id: safeId,
            userId: auth.userId,
            title: String(nb.title).slice(0, 200),
            description: String(nb.description || '').slice(0, 1900),
            color: nb.color || 'from-indigo-600 to-purple-600',
            createdAt: nb.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          auth
        );
        importedNotebooks++;
      }

      const defaultNb = await workspaceRepository.ensureDefaultNotebook(auth);

      for (const src of sources) {
        if (!src?.content || !String(src.content).trim()) continue;
        const nbId = nbIdMap.get(src.notebookId) || defaultNb.id;
        await documentService.processPastedDocument(
          String(src.title || 'Migrated Document'),
          String(src.content),
          nbId,
          auth
        );
        importedSources++;
      }

      for (const note of notes) {
        if (!note?.title) continue;
        const nbId = nbIdMap.get(note.notebookId) || defaultNb.id;
        await workspaceRepository.saveNote(
          {
            id: makeSafeId('note'),
            userId: auth.userId,
            notebookId: nbId,
            title: String(note.title).slice(0, 290),
            content: String(note.content || ''),
            tags: Array.isArray(note.tags) ? note.tags : [],
            updatedAt: note.updatedAt || new Date().toISOString(),
          },
          auth,
          false
        );
        importedNotes++;
      }

      for (const set of flashcardSets) {
        if (!set?.title || !Array.isArray(set.cards)) continue;
        const nbId = nbIdMap.get(set.notebookId) || defaultNb.id;
        await flashcardRepository.saveSet(
          {
            id: makeSafeId('fcset'),
            userId: auth.userId,
            notebookId: nbId,
            title: String(set.title).slice(0, 290),
            description: String(set.description || ''),
            category: String(set.category || 'Migrated'),
            cards: set.cards,
            createdAt: set.createdAt || new Date().toISOString(),
          },
          auth
        );
        importedDecks++;
      }

      for (const qz of quizSets) {
        if (!qz?.title || !Array.isArray(qz.questions)) continue;
        const nbId = nbIdMap.get(qz.notebookId) || defaultNb.id;
        await quizRepository.saveQuiz(
          {
            id: makeSafeId('quiz'),
            userId: auth.userId,
            notebookId: nbId,
            title: String(qz.title).slice(0, 290),
            description: String(qz.description || ''),
            questions: qz.questions,
            createdAt: qz.createdAt || new Date().toISOString(),
          },
          auth
        );
        importedQuizzes++;
      }

      res.json({
        success: true,
        imported: {
          notebooks: importedNotebooks,
          sources: importedSources,
          notes: importedNotes,
          flashcardSets: importedDecks,
          quizSets: importedQuizzes,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

export const workspaceController = new WorkspaceController();
