import { firestoreRest } from '../config/firestore_rest';
import {
  ActivityLogModel,
  DocumentAnnotationModel,
  NotebookModel,
  NoteVersionModel,
  NotificationModel,
  QuizAttemptModel,
  StudyNoteModel,
  StudyTaskModel,
  UserProfileDoc,
} from '../models/workspace.model';
import { AuthContext, makeSafeId, pickAllowedKeys } from './base.repository';

const USER_KEYS = [
  'uid', 'email', 'name', 'avatar', 'role', 'studyGoalMinutes',
  'streakDays', 'cardsMastered', 'quizzesCompleted', 'timeSpentMinutes',
  'status', 'createdAt', 'updatedAt',
] as const;

const NOTEBOOK_KEYS = [
  'id', 'userId', 'title', 'description', 'color', 'createdAt', 'updatedAt',
] as const;

const NOTE_KEYS = [
  'id', 'userId', 'notebookId', 'title', 'content', 'tags', 'aiGenerated', 'createdAt', 'updatedAt',
] as const;

const NOTE_VERSION_KEYS = [
  'id', 'userId', 'noteId', 'title', 'content', 'savedAt',
] as const;

const STUDY_TASK_KEYS = [
  'id', 'userId', 'title', 'subject', 'scheduledDate', 'durationMinutes',
  'completed', 'priority', 'taskType', 'createdAt',
] as const;

const NOTIFICATION_KEYS = [
  'id', 'userId', 'title', 'message', 'type', 'read', 'createdAt',
] as const;

const QUIZ_ATTEMPT_KEYS = [
  'id', 'userId', 'quizSetId', 'quizTitle', 'score', 'scorePercent',
  'totalQuestions', 'correctCount', 'timeTakenSeconds', 'answers', 'completedAt',
] as const;

const ACTIVITY_LOG_KEYS = [
  'id', 'userId', 'type', 'title', 'details', 'score', 'timestamp', 'createdAt',
] as const;

const ANNOTATION_KEYS = [
  'id', 'userId', 'documentId', 'notebookId', 'pageNumber', 'content', 'type', 'createdAt', 'updatedAt',
] as const;

export class WorkspaceRepository {
  // ---------------- USERS ----------------
  public async ensureUserProfile(auth: AuthContext, fallbackName?: string, fallbackAvatar?: string): Promise<UserProfileDoc> {
    const existing = await firestoreRest.getDoc<UserProfileDoc>('users', auth.userId, auth.idToken);
    if (existing) return existing;

    const now = new Date().toISOString();
    const isAdmin = auth.role === 'Admin';

    // Notice firestore.rules restricts self-create to role in ['Student', 'Educator'] unless already Admin via admins/{uid}
    const initialRole: 'Student' | 'Educator' | 'Admin' = isAdmin ? 'Admin' : 'Student';

    const profile: UserProfileDoc = {
      uid: auth.userId,
      email: auth.email || '',
      name: fallbackName || (auth.email ? auth.email.split('@')[0] : 'Student'),
      avatar: fallbackAvatar || '',
      role: initialRole,
      studyGoalMinutes: 60,
      streakDays: 1,
      cardsMastered: 0,
      quizzesCompleted: 0,
      timeSpentMinutes: 0,
      status: 'Active',
      createdAt: now,
      updatedAt: now,
    };

    const clean = pickAllowedKeys(profile, USER_KEYS) as UserProfileDoc;
    const saved = await firestoreRest.setDoc<UserProfileDoc>('users', auth.userId, clean, auth.idToken);
    return {
      ...saved,
      role: isAdmin ? 'Admin' : saved.role,
    };
  }

  public async updateUserProfile(auth: AuthContext, updates: Partial<UserProfileDoc>): Promise<UserProfileDoc> {
    await this.ensureUserProfile(auth);
    const safeUpdates: Record<string, any> = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    delete safeUpdates.uid;
    delete safeUpdates.createdAt;
    delete safeUpdates.role;
    delete safeUpdates.status;
    const clean = pickAllowedKeys(safeUpdates, USER_KEYS);
    return firestoreRest.patchDoc<UserProfileDoc>('users', auth.userId, clean, auth.idToken);
  }

  public async listAllUsersAdmin(auth: AuthContext): Promise<UserProfileDoc[]> {
    return firestoreRest.listAllAdmin<UserProfileDoc>('users', auth.idToken);
  }

  public async adminUpdateUser(
    targetUid: string,
    updates: { role?: 'Student' | 'Educator' | 'Admin'; status?: 'Active' | 'Suspended' },
    auth: AuthContext
  ): Promise<UserProfileDoc | null> {
    const existing = await firestoreRest.getDoc<UserProfileDoc>('users', targetUid, auth.idToken);
    if (!existing) return null;
    const payload: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };
    if (updates.role) payload.role = updates.role;
    if (updates.status) payload.status = updates.status;
    return firestoreRest.patchDoc<UserProfileDoc>('users', targetUid, payload, auth.idToken);
  }

  public async adminDeleteUser(targetUid: string, auth: AuthContext): Promise<boolean> {
    const existing = await firestoreRest.getDoc<UserProfileDoc>('users', targetUid, auth.idToken);
    if (!existing) return false;
    return firestoreRest.deleteDoc('users', targetUid, auth.idToken);
  }

  // ---------------- NOTEBOOKS ----------------
  public async getNotebooks(auth: AuthContext): Promise<NotebookModel[]> {
    const list = await firestoreRest.listByUser<NotebookModel>('notebooks', auth.userId, auth.idToken);
    return list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  }

  public async ensureDefaultNotebook(auth: AuthContext): Promise<NotebookModel> {
    const existing = await this.getNotebooks(auth);
    if (existing.length > 0) return existing[0];
    const now = new Date().toISOString();
    const nb: NotebookModel = {
      id: `nb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: auth.userId,
      title: 'My Study Workspace',
      description: 'Default personal notebook for uploaded documents, notes, flashcards, and quizzes.',
      color: 'from-indigo-600 to-purple-600',
      createdAt: now,
      updatedAt: now,
    };
    return this.saveNotebook(nb, auth);
  }

  public async saveNotebook(nb: NotebookModel, auth: AuthContext): Promise<NotebookModel> {
    const payload: NotebookModel = {
      ...nb,
      userId: auth.userId,
      updatedAt: new Date().toISOString(),
    };
    const clean = pickAllowedKeys(payload, NOTEBOOK_KEYS) as NotebookModel;
    return firestoreRest.setDoc<NotebookModel>('notebooks', clean.id, clean, auth.idToken);
  }

  public async deleteNotebook(id: string, auth: AuthContext): Promise<boolean> {
    const existing = await firestoreRest.getDoc<NotebookModel>('notebooks', id, auth.idToken);
    if (!existing || existing.userId !== auth.userId) return false;
    return firestoreRest.deleteDoc('notebooks', id, auth.idToken);
  }

  // ---------------- STUDY NOTES + VERSIONS ----------------
  public async getNotes(auth: AuthContext, notebookId?: string): Promise<StudyNoteModel[]> {
    const list = await firestoreRest.listByUser<StudyNoteModel>('study_notes', auth.userId, auth.idToken);
    const filtered = notebookId ? list.filter((n) => n.notebookId === notebookId) : list;
    return filtered.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }

  public async saveNote(note: StudyNoteModel, auth: AuthContext, saveSnapshot = true): Promise<StudyNoteModel> {
    const now = new Date().toISOString();
    const payload: StudyNoteModel = {
      ...note,
      userId: auth.userId,
      content: (note.content || '').slice(0, 295000),
      tags: Array.isArray(note.tags) ? note.tags.slice(0, 30) : [],
      createdAt: note.createdAt || now,
      updatedAt: now,
    };
    const clean = pickAllowedKeys(payload, NOTE_KEYS) as StudyNoteModel;
    const saved = await firestoreRest.setDoc<StudyNoteModel>('study_notes', clean.id, clean, auth.idToken);

    if (saveSnapshot && saved.content.trim().length > 0) {
      const version: NoteVersionModel = {
        id: makeSafeId('nver'),
        userId: auth.userId,
        noteId: saved.id,
        title: saved.title,
        content: saved.content,
        savedAt: now,
      };
      const cleanVer = pickAllowedKeys(version, NOTE_VERSION_KEYS) as NoteVersionModel;
      await firestoreRest.setDoc('note_versions', cleanVer.id, cleanVer, auth.idToken).catch(() => {});
    }

    return saved;
  }

  public async getNoteVersions(noteId: string, auth: AuthContext): Promise<NoteVersionModel[]> {
    const all = await firestoreRest.listByUser<NoteVersionModel>('note_versions', auth.userId, auth.idToken);
    return all
      .filter((v) => v.noteId === noteId)
      .sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''))
      .slice(0, 20);
  }

  public async deleteNote(id: string, auth: AuthContext): Promise<boolean> {
    const existing = await firestoreRest.getDoc<StudyNoteModel>('study_notes', id, auth.idToken);
    if (!existing || existing.userId !== auth.userId) return false;
    return firestoreRest.deleteDoc('study_notes', id, auth.idToken);
  }

  // ---------------- STUDY TASKS ----------------
  public async getTasks(auth: AuthContext): Promise<StudyTaskModel[]> {
    const list = await firestoreRest.listByUser<StudyTaskModel>('study_tasks', auth.userId, auth.idToken);
    return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  public async saveTask(task: StudyTaskModel, auth: AuthContext): Promise<StudyTaskModel> {
    const payload: StudyTaskModel = {
      ...task,
      userId: auth.userId,
      createdAt: task.createdAt || new Date().toISOString(),
    };
    const clean = pickAllowedKeys(payload, STUDY_TASK_KEYS) as StudyTaskModel;
    return firestoreRest.setDoc<StudyTaskModel>('study_tasks', clean.id, clean, auth.idToken);
  }

  public async deleteTask(id: string, auth: AuthContext): Promise<boolean> {
    const existing = await firestoreRest.getDoc<StudyTaskModel>('study_tasks', id, auth.idToken);
    if (!existing || existing.userId !== auth.userId) return false;
    return firestoreRest.deleteDoc('study_tasks', id, auth.idToken);
  }

  // ---------------- NOTIFICATIONS ----------------
  public async getNotifications(auth: AuthContext): Promise<NotificationModel[]> {
    const list = await firestoreRest.listByUser<NotificationModel>('notifications', auth.userId, auth.idToken);
    return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  public async createNotification(
    item: Omit<NotificationModel, 'id' | 'userId' | 'createdAt'>,
    auth: AuthContext
  ): Promise<NotificationModel> {
    const payload: NotificationModel = {
      ...item,
      id: makeSafeId('notif'),
      userId: auth.userId,
      createdAt: new Date().toISOString(),
    };
    const clean = pickAllowedKeys(payload, NOTIFICATION_KEYS) as NotificationModel;
    return firestoreRest.setDoc('notifications', clean.id, clean, auth.idToken);
  }

  public async markNotificationRead(id: string, auth: AuthContext): Promise<NotificationModel | null> {
    const existing = await firestoreRest.getDoc<NotificationModel>('notifications', id, auth.idToken);
    if (!existing || existing.userId !== auth.userId) return null;
    return firestoreRest.patchDoc('notifications', id, { read: true }, auth.idToken);
  }

  public async deleteNotification(id: string, auth: AuthContext): Promise<boolean> {
    const existing = await firestoreRest.getDoc<NotificationModel>('notifications', id, auth.idToken);
    if (!existing || existing.userId !== auth.userId) return false;
    return firestoreRest.deleteDoc('notifications', id, auth.idToken);
  }

  // ---------------- QUIZ ATTEMPTS ----------------
  public async getQuizAttempts(auth: AuthContext): Promise<QuizAttemptModel[]> {
    const list = await firestoreRest.listByUser<QuizAttemptModel>('quiz_attempts', auth.userId, auth.idToken);
    return list.sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
  }

  public async saveQuizAttempt(
    attempt: Omit<QuizAttemptModel, 'id' | 'userId' | 'completedAt'>,
    auth: AuthContext
  ): Promise<QuizAttemptModel> {
    const payload: QuizAttemptModel = {
      ...attempt,
      id: makeSafeId('qatt'),
      userId: auth.userId,
      completedAt: new Date().toISOString(),
    };
    const clean = pickAllowedKeys(payload, QUIZ_ATTEMPT_KEYS) as QuizAttemptModel;
    return firestoreRest.setDoc('quiz_attempts', clean.id, clean, auth.idToken);
  }

  // ---------------- ACTIVITY LOGS ----------------
  public async getActivityLogs(auth: AuthContext): Promise<ActivityLogModel[]> {
    const list = await firestoreRest.listByUser<ActivityLogModel>('activity_logs', auth.userId, auth.idToken);
    return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  public async addActivityLog(
    item: Omit<ActivityLogModel, 'id' | 'userId' | 'createdAt'>,
    auth: AuthContext
  ): Promise<ActivityLogModel> {
    const now = new Date().toISOString();
    const payload: ActivityLogModel = {
      ...item,
      id: makeSafeId('act'),
      userId: auth.userId,
      timestamp: item.timestamp || now,
      createdAt: now,
    };
    const clean = pickAllowedKeys(payload, ACTIVITY_LOG_KEYS) as ActivityLogModel;
    return firestoreRest.setDoc('activity_logs', clean.id, clean, auth.idToken);
  }

  public async clearActivityLogs(auth: AuthContext): Promise<void> {
    const list = await this.getActivityLogs(auth);
    for (const log of list) {
      await firestoreRest.deleteDoc('activity_logs', log.id, auth.idToken).catch(() => {});
    }
  }

  // ---------------- DOCUMENT ANNOTATIONS ----------------
  public async getAnnotations(
    auth: AuthContext,
    documentId?: string
  ): Promise<DocumentAnnotationModel[]> {
    const list = await firestoreRest.listByUser<DocumentAnnotationModel>(
      'document_annotations',
      auth.userId,
      auth.idToken
    );
    const filtered = documentId ? list.filter((a) => a.documentId === documentId) : list;
    return filtered.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  public async saveAnnotation(
    item: DocumentAnnotationModel,
    auth: AuthContext
  ): Promise<DocumentAnnotationModel> {
    const now = new Date().toISOString();
    const payload: DocumentAnnotationModel = {
      ...item,
      userId: auth.userId,
      createdAt: item.createdAt || now,
      updatedAt: now,
    };
    const clean = pickAllowedKeys(payload, ANNOTATION_KEYS) as DocumentAnnotationModel;
    return firestoreRest.setDoc('document_annotations', clean.id, clean, auth.idToken);
  }

  public async deleteAnnotation(id: string, auth: AuthContext): Promise<boolean> {
    const existing = await firestoreRest.getDoc<DocumentAnnotationModel>(
      'document_annotations',
      id,
      auth.idToken
    );
    if (!existing || existing.userId !== auth.userId) return false;
    return firestoreRest.deleteDoc('document_annotations', id, auth.idToken);
  }

  // ---------------- FULL USER WORKSPACE DELETION ----------------
  public async deleteAllUserWorkspaceData(auth: AuthContext): Promise<void> {
    const collections = [
      'user_preferences',
      'notebooks',
      'documents',
      'document_chunks',
      'document_blobs',
      'document_jobs',
      'document_annotations',
      'study_notes',
      'note_versions',
      'flashcard_sets',
      'quiz_sets',
      'quiz_attempts',
      'chat_sessions',
      'study_plans',
      'study_tasks',
      'notifications',
      'search_history',
      'recent_documents',
      'ai_usage_logs',
      'activity_logs',
      'study_sessions',
      'diagrams',
      'exam_prep_guides',
      'topic_mastery',
      'audio_lectures',
    ];

    for (const col of collections) {
      if (col === 'user_preferences') {
        await firestoreRest.deleteDoc('user_preferences', auth.userId, auth.idToken).catch(() => {});
        continue;
      }
      const docs = await firestoreRest.listByUser<{ id: string }>(col, auth.userId, auth.idToken).catch(() => []);
      for (const doc of docs) {
        if (doc?.id) {
          await firestoreRest.deleteDoc(col, doc.id, auth.idToken).catch(() => {});
        }
      }
    }

    await firestoreRest.deleteDoc('users', auth.userId, auth.idToken).catch(() => {});
  }
}

export const workspaceRepository = new WorkspaceRepository();
