import { chatHistoryRepository } from '../repositories/chat_history.repository';
import { ChatSessionModel, ChatMessageModel } from '../models/chat.model';

export class ChatHistoryService {
  public async getSessions(): Promise<ChatSessionModel[]> {
    return chatHistoryRepository.getAllSessions();
  }

  public async getSessionById(id: string): Promise<ChatSessionModel | undefined> {
    return chatHistoryRepository.getSession(id);
  }

  public async searchSessions(query: string): Promise<ChatSessionModel[]> {
    return chatHistoryRepository.searchSessions(query);
  }

  public async renameSession(id: string, title: string): Promise<ChatSessionModel | undefined> {
    return chatHistoryRepository.renameSession(id, title);
  }

  public async archiveSession(id: string, isArchived = true): Promise<ChatSessionModel | undefined> {
    return chatHistoryRepository.archiveSession(id, isArchived);
  }

  public async createSession(
    title: string,
    messages: ChatMessageModel[] = [],
    persona: any = 'Standard Tutor',
    notebookId?: string
  ): Promise<ChatSessionModel> {
    const id = `chat-session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const session: ChatSessionModel = {
      id,
      title,
      notebookId,
      persona,
      isArchived: false,
      messages,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return chatHistoryRepository.saveSession(session);
  }

  public async addMessage(sessionId: string, message: ChatMessageModel): Promise<ChatSessionModel | undefined> {
    return chatHistoryRepository.addMessage(sessionId, message);
  }

  public async deleteSession(id: string): Promise<boolean> {
    return chatHistoryRepository.deleteSession(id);
  }

  public async clearAll(): Promise<void> {
    return chatHistoryRepository.clearAll();
  }
}

export const chatHistoryService = new ChatHistoryService();
