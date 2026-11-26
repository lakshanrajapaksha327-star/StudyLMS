import { firestoreRest } from '../config/firestore_rest';
import { ChatMessageModel, ChatSessionModel } from '../models/chat.model';
import { AuthContext, pickAllowedKeys } from './base.repository';

const CHAT_SESSION_KEYS = [
  'id',
  'userId',
  'notebookId',
  'title',
  'persona',
  'isArchived',
  'messages',
  'createdAt',
  'updatedAt',
] as const;

export class ChatHistoryRepository {
  public async saveSession(session: ChatSessionModel, auth: AuthContext): Promise<ChatSessionModel> {
    const now = new Date().toISOString();
    const payload: ChatSessionModel = {
      ...session,
      userId: auth.userId,
      isArchived: Boolean(session.isArchived),
      messages: (session.messages || []).slice(-250),
      createdAt: session.createdAt || now,
      updatedAt: now,
    };
    const clean = pickAllowedKeys(payload, CHAT_SESSION_KEYS) as ChatSessionModel;
    return firestoreRest.setDoc('chat_sessions', clean.id, clean, auth.idToken);
  }

  public async getSession(id: string, auth: AuthContext): Promise<ChatSessionModel | undefined> {
    const session = await firestoreRest.getDoc<ChatSessionModel>('chat_sessions', id, auth.idToken);
    if (!session || session.userId !== auth.userId) return undefined;
    return session;
  }

  public async getAllSessions(auth: AuthContext): Promise<ChatSessionModel[]> {
    const list = await firestoreRest.listByUser<ChatSessionModel>(
      'chat_sessions',
      auth.userId,
      auth.idToken
    );
    return list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }

  public async searchSessions(query: string, auth: AuthContext): Promise<ChatSessionModel[]> {
    const all = await this.getAllSessions(auth);
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (s) =>
        (s.title || '').toLowerCase().includes(q) ||
        (s.messages || []).some((m) => (m.text || '').toLowerCase().includes(q))
    );
  }

  public async renameSession(
    id: string,
    title: string,
    auth: AuthContext
  ): Promise<ChatSessionModel | undefined> {
    const existing = await this.getSession(id, auth);
    if (!existing) return undefined;
    return firestoreRest.patchDoc<ChatSessionModel>(
      'chat_sessions',
      id,
      { title: title.slice(0, 290), updatedAt: new Date().toISOString() },
      auth.idToken
    );
  }

  public async archiveSession(
    id: string,
    isArchived: boolean,
    auth: AuthContext
  ): Promise<ChatSessionModel | undefined> {
    const existing = await this.getSession(id, auth);
    if (!existing) return undefined;
    return firestoreRest.patchDoc<ChatSessionModel>(
      'chat_sessions',
      id,
      { isArchived, updatedAt: new Date().toISOString() },
      auth.idToken
    );
  }

  public async addMessage(
    sessionId: string,
    message: ChatMessageModel,
    auth: AuthContext
  ): Promise<ChatSessionModel | undefined> {
    const session = await this.getSession(sessionId, auth);
    if (!session) return undefined;
    const messages = [...(session.messages || []), message].slice(-250);
    return firestoreRest.patchDoc<ChatSessionModel>(
      'chat_sessions',
      sessionId,
      { messages, updatedAt: new Date().toISOString() },
      auth.idToken
    );
  }

  public async deleteSession(id: string, auth: AuthContext): Promise<boolean> {
    const existing = await this.getSession(id, auth);
    if (!existing) return false;
    return firestoreRest.deleteDoc('chat_sessions', id, auth.idToken);
  }

  public async clearAll(auth: AuthContext): Promise<void> {
    const sessions = await this.getAllSessions(auth);
    for (const s of sessions) {
      await firestoreRest.deleteDoc('chat_sessions', s.id, auth.idToken).catch(() => {});
    }
  }
}

export const chatHistoryRepository = new ChatHistoryRepository();
