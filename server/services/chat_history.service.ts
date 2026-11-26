import { ChatMessageModel, ChatSessionModel } from '../models/chat.model';
import { AuthContext, makeSafeId } from '../repositories/base.repository';
import { chatHistoryRepository } from '../repositories/chat_history.repository';

export class ChatHistoryService {
  public async getSessions(auth: AuthContext): Promise<ChatSessionModel[]> {
    return chatHistoryRepository.getAllSessions(auth);
  }

  public async getSessionById(id: string, auth: AuthContext): Promise<ChatSessionModel | undefined> {
    return chatHistoryRepository.getSession(id, auth);
  }

  public async searchSessions(query: string, auth: AuthContext): Promise<ChatSessionModel[]> {
    return chatHistoryRepository.searchSessions(query, auth);
  }

  public async renameSession(
    id: string,
    title: string,
    auth: AuthContext
  ): Promise<ChatSessionModel | undefined> {
    return chatHistoryRepository.renameSession(id, title, auth);
  }

  public async archiveSession(
    id: string,
    isArchived: boolean,
    auth: AuthContext
  ): Promise<ChatSessionModel | undefined> {
    return chatHistoryRepository.archiveSession(id, isArchived, auth);
  }

  public async createSession(
    title: string,
    messages: ChatMessageModel[] = [],
    persona: any = 'Standard Tutor',
    notebookId: string | undefined,
    auth: AuthContext
  ): Promise<ChatSessionModel> {
    const id = makeSafeId('chat');
    const now = new Date().toISOString();
    const session: ChatSessionModel = {
      id,
      userId: auth.userId,
      title,
      notebookId,
      persona,
      isArchived: false,
      messages,
      createdAt: now,
      updatedAt: now,
    };
    return chatHistoryRepository.saveSession(session, auth);
  }

  public async addMessage(
    sessionId: string,
    message: ChatMessageModel,
    auth: AuthContext
  ): Promise<ChatSessionModel | undefined> {
    return chatHistoryRepository.addMessage(sessionId, message, auth);
  }

  public async deleteSession(id: string, auth: AuthContext): Promise<boolean> {
    return chatHistoryRepository.deleteSession(id, auth);
  }

  public async clearAll(auth: AuthContext): Promise<void> {
    return chatHistoryRepository.clearAll(auth);
  }
}

export const chatHistoryService = new ChatHistoryService();
