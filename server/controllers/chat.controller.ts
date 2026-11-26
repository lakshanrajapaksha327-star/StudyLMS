import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../middleware/validate.middleware';
import { getAuthContext } from '../repositories/base.repository';
import { chatService } from '../services/chat.service';

export class ChatController {
  public async handleChat(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const {
        messages,
        sources,
        selectedDocumentIds,
        notebookId,
        notebookTitle,
        persona,
        sessionId,
        strictGrounded,
      } = req.body;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        throw new ApiError(400, 'At least one chat message is required.');
      }

      const result = await chatService.handleChat(
        {
          messages,
          sources,
          selectedDocumentIds,
          notebookId,
          notebookTitle,
          persona,
          sessionId,
          strictGrounded,
        },
        auth
      );

      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
}

export const chatController = new ChatController();
