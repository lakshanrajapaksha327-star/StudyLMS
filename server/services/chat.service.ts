import { ChatRequest, ChatResponse, ChatMessageModel, ChatSessionModel } from '../models/chat.model';
import { geminiService } from './gemini.service';
import { chatHistoryRepository } from '../repositories/chat_history.repository';

export class ChatService {
  public async handleChat(request: ChatRequest): Promise<ChatResponse> {
    const { messages, sources, notebookTitle, persona = 'Standard Tutor', sessionId } = request;

    // Build context string from sources
    let sourcesContext = '';
    if (sources && Array.isArray(sources) && sources.length > 0) {
      sourcesContext = sources
        .map(
          (s, idx) =>
            `--- Source ${idx + 1}: "${s.title}" ---\n${s.content.slice(0, 4000)}\n`
        )
        .join('\n');
    }

    const { text, suggestedQuestions } = await geminiService.generateChatResponse(
      messages,
      sourcesContext,
      persona,
      notebookTitle
    );

    const sourcesUsed = sources?.map((s) => s.title) || [];

    // Save to chat history session if sessionId is provided or auto-create
    let currentSessionId = sessionId;
    if (currentSessionId) {
      const existingSession = await chatHistoryRepository.getSession(currentSessionId);
      if (existingSession) {
        // Append user last message and assistant reply
        const userLast = messages[messages.length - 1];
        if (userLast && userLast.sender === 'user') {
          await chatHistoryRepository.addMessage(currentSessionId, userLast);
        }
        await chatHistoryRepository.addMessage(currentSessionId, {
          id: `msg-${Date.now()}`,
          sender: 'assistant',
          text,
          timestamp: new Date().toISOString(),
          sourcesUsed,
          suggestedQuestions,
        });
      }
    } else if (messages.length > 0) {
      // Create a new session
      const newSessionId = `chat-session-${Date.now()}`;
      const firstUserMsg = messages.find((m) => m.sender === 'user')?.text || 'Study Chat';
      const title = firstUserMsg.length > 35 ? `${firstUserMsg.substring(0, 35)}...` : firstUserMsg;

      const newSession: ChatSessionModel = {
        id: newSessionId,
        title,
        notebookId: undefined,
        persona: persona as any,
        messages: [
          ...messages,
          {
            id: `msg-${Date.now()}`,
            sender: 'assistant',
            text,
            timestamp: new Date().toISOString(),
            sourcesUsed,
            suggestedQuestions,
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await chatHistoryRepository.saveSession(newSession);
      currentSessionId = newSessionId;
    }

    return {
      text,
      suggestedQuestions,
      sourcesUsed,
      sessionId: currentSessionId,
    };
  }
}

export const chatService = new ChatService();
