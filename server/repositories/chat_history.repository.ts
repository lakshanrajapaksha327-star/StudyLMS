import { ChatSessionModel, ChatMessageModel } from '../models/chat.model';

class ChatHistoryRepository {
  private sessions: Map<string, ChatSessionModel> = new Map();

  public async saveSession(session: ChatSessionModel): Promise<ChatSessionModel> {
    this.sessions.set(session.id, session);
    return session;
  }

  public async getSession(id: string): Promise<ChatSessionModel | undefined> {
    return this.sessions.get(id);
  }

  public async getAllSessions(includeArchived = false): Promise<ChatSessionModel[]> {
    return Array.from(this.sessions.values())
      .filter((s) => includeArchived || !s.isArchived)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  public async searchSessions(query: string): Promise<ChatSessionModel[]> {
    const q = query.toLowerCase();
    return Array.from(this.sessions.values()).filter((session) => {
      if (session.title.toLowerCase().includes(q)) return true;
      return session.messages.some((m) => m.text.toLowerCase().includes(q));
    });
  }

  public async renameSession(id: string, title: string): Promise<ChatSessionModel | undefined> {
    const session = this.sessions.get(id);
    if (!session) return undefined;

    session.title = title;
    session.updatedAt = new Date().toISOString();
    this.sessions.set(id, session);
    return session;
  }

  public async archiveSession(id: string, isArchived = true): Promise<ChatSessionModel | undefined> {
    const session = this.sessions.get(id);
    if (!session) return undefined;

    session.isArchived = isArchived;
    session.updatedAt = new Date().toISOString();
    this.sessions.set(id, session);
    return session;
  }

  public async addMessage(sessionId: string, message: ChatMessageModel): Promise<ChatSessionModel | undefined> {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    session.messages.push(message);
    session.updatedAt = new Date().toISOString();
    this.sessions.set(sessionId, session);
    return session;
  }

  public async deleteSession(id: string): Promise<boolean> {
    return this.sessions.delete(id);
  }

  public async clearAll(): Promise<void> {
    this.sessions.clear();
  }
}

export const chatHistoryRepository = new ChatHistoryRepository();
