import { Request, Response } from 'express';
import { chatService } from '../services/chat.service';

export class ChatController {
  public async handleChat(req: Request, res: Response) {
    try {
      const { messages, sources, notebookTitle, persona, sessionId } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid message history.' });
      }

      const result = await chatService.handleChat({
        messages,
        sources,
        notebookTitle,
        persona,
        sessionId,
      });

      res.json(result);
    } catch (error: any) {
      console.error('ChatController Error:', error);
      res.status(500).json({
        error: 'Failed to generate study chat response with Gemini',
        details: error?.message || String(error),
      });
    }
  }
}

export const chatController = new ChatController();
