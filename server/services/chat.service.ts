import { ChatMessageCitation, ChatRequest, ChatResponse, ChatSessionModel } from '../models/chat.model';
import { AuthContext, makeSafeId } from '../repositories/base.repository';
import { chatHistoryRepository } from '../repositories/chat_history.repository';
import { workspaceRepository } from '../repositories/workspace.repository';
import { geminiService } from './gemini.service';
import { ragService } from './rag.service';

export class ChatService {
  public async handleChat(request: ChatRequest, auth: AuthContext): Promise<ChatResponse> {
    const {
      messages,
      sources,
      selectedDocumentIds,
      notebookId,
      notebookTitle,
      persona = 'Standard Tutor',
      sessionId,
      strictGrounded = true,
    } = request;

    const latestUserMessage = [...messages].reverse().find((m) => m.sender === 'user')?.text || '';

    // 1. Attempt semantic + lexical RAG retrieval from persisted document_chunks
    const rag = await ragService.retrieveContext({
      query: latestUserMessage || notebookTitle || 'summary',
      auth,
      notebookId,
      selectedDocumentIds,
      topK: 10,
      maxContextTokens: 6000,
    });

    let sourcesContext = rag.formattedContext;
    let hasEvidence = rag.hasEvidence;
    let citations: ChatMessageCitation[] = rag.citations.map((c) => ({
      documentId: c.documentId,
      documentTitle: c.documentTitle,
      pageNumber: c.pageNumber,
      slideNumber: c.slideNumber,
      sectionHeading: c.sectionHeading,
      excerpt: c.excerpt,
      score: c.score,
    }));

    // 2. Fallback to inline client-provided source excerpts (e.g., if user asked from Demo Mode or immediate unsaved note)
    if (!hasEvidence && sources && Array.isArray(sources) && sources.length > 0) {
      const targetSources =
        selectedDocumentIds && selectedDocumentIds.length > 0
          ? sources.filter((s) => !s.id || selectedDocumentIds.includes(s.id))
          : sources;
      const nonEmpty = targetSources.filter((s) => s.content && s.content.trim().length > 0);
      if (nonEmpty.length > 0) {
        hasEvidence = true;
        sourcesContext = nonEmpty
          .map((s, idx) => {
            const safeTitle = s.title.replace(/["<>]/g, '');
            const safeBody = s.content.slice(0, 10000).replace(/<\/?untrusted_study_source[^>]*>/gi, '');
            return `<untrusted_study_source location="Source ${idx + 1}: ${safeTitle}">\n[Source ${idx + 1}: "${safeTitle}"]\n${safeBody}\n</untrusted_study_source>`;
          })
          .join('\n\n---\n\n');
        citations = nonEmpty.map((s, idx) => ({
          documentId: s.id || `inline-${idx}`,
          documentTitle: s.title,
          excerpt: s.content.slice(0, 260),
        }));
      }
    }

    const { text, suggestedQuestions } = await geminiService.generateChatResponse({
      messages,
      sourcesContext,
      hasEvidence,
      persona,
      notebookTitle,
      strictGrounded,
      auth,
    });

    const sourcesUsed = Array.from(new Set(citations.map((c) => c.documentTitle)));

    let currentSessionId = sessionId;
    if (currentSessionId) {
      const existingSession = await chatHistoryRepository.getSession(currentSessionId, auth);
      if (existingSession) {
        const userLast = messages[messages.length - 1];
        if (userLast && userLast.sender === 'user') {
          await chatHistoryRepository.addMessage(currentSessionId, userLast, auth);
        }
        await chatHistoryRepository.addMessage(
          currentSessionId,
          {
            id: makeSafeId('msg'),
            sender: 'assistant',
            text,
            timestamp: new Date().toISOString(),
            sourcesUsed,
            suggestedQuestions,
            citations,
          },
          auth
        );
      }
    } else if (messages.length > 0) {
      const newSessionId = makeSafeId('chat');
      const firstUserMsg = messages.find((m) => m.sender === 'user')?.text || 'Study Chat';
      const title = firstUserMsg.length > 45 ? `${firstUserMsg.slice(0, 45)}...` : firstUserMsg;

      const newSession: ChatSessionModel = {
        id: newSessionId,
        userId: auth.userId,
        title,
        notebookId,
        persona: persona as any,
        isArchived: false,
        messages: [
          ...messages,
          {
            id: makeSafeId('msg'),
            sender: 'assistant',
            text,
            timestamp: new Date().toISOString(),
            sourcesUsed,
            suggestedQuestions,
            citations,
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await chatHistoryRepository.saveSession(newSession, auth);
      currentSessionId = newSessionId;
    }

    await workspaceRepository
      .addActivityLog(
        {
          type: 'chat_query',
          title: latestUserMessage.slice(0, 120) || 'AI Tutor Question',
          details: sourcesUsed.length
            ? `Grounded across ${sourcesUsed.length} source(s)`
            : 'General AI Tutor response',
        },
        auth
      )
      .catch(() => {});

    return {
      text,
      suggestedQuestions,
      sourcesUsed,
      citations,
      sessionId: currentSessionId,
      grounded: hasEvidence,
    };
  }
}

export const chatService = new ChatService();
