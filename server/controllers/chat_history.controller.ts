import { Request, Response, NextFunction } from 'express';
import { ApiError, isValidResourceId } from '../middleware/validate.middleware';
import { getAuthContext } from '../repositories/base.repository';
import { chatHistoryService } from '../services/chat_history.service';

export class ChatHistoryController {
  public async getSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const sessions = await chatHistoryService.getSessions(auth);
      res.json({ success: true, sessions });
    } catch (err) {
      next(err);
    }
  }

  public async getSessionById(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      if (!isValidResourceId(req.params.id)) throw new ApiError(400, 'Invalid session ID.');
      const session = await chatHistoryService.getSessionById(req.params.id, auth);
      if (!session) throw new ApiError(404, 'Chat session not found.', 'NOT_FOUND');
      res.json({ success: true, session });
    } catch (err) {
      next(err);
    }
  }

  public async createSession(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { title, messages, persona, notebookId } = req.body;
      const session = await chatHistoryService.createSession(
        title || 'New Study Session',
        messages || [],
        persona || 'Standard Tutor',
        notebookId,
        auth
      );
      res.status(201).json({ success: true, session });
    } catch (err) {
      next(err);
    }
  }

  public async searchSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const q = (req.query.q as string) || '';
      const sessions = await chatHistoryService.searchSessions(q, auth);
      res.json({ success: true, sessions });
    } catch (err) {
      next(err);
    }
  }

  public async renameSession(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      if (!isValidResourceId(req.params.id)) throw new ApiError(400, 'Invalid session ID.');
      const { title } = req.body;
      if (!title || !String(title).trim()) throw new ApiError(400, 'Title required.');
      const session = await chatHistoryService.renameSession(req.params.id, String(title).trim(), auth);
      if (!session) throw new ApiError(404, 'Session not found.', 'NOT_FOUND');
      res.json({ success: true, session });
    } catch (err) {
      next(err);
    }
  }

  public async archiveSession(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      if (!isValidResourceId(req.params.id)) throw new ApiError(400, 'Invalid session ID.');
      const { isArchived = true } = req.body;
      const session = await chatHistoryService.archiveSession(req.params.id, Boolean(isArchived), auth);
      if (!session) throw new ApiError(404, 'Session not found.', 'NOT_FOUND');
      res.json({ success: true, session });
    } catch (err) {
      next(err);
    }
  }

  public async deleteSession(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      if (!isValidResourceId(req.params.id)) throw new ApiError(400, 'Invalid session ID.');
      const success = await chatHistoryService.deleteSession(req.params.id, auth);
      if (!success) throw new ApiError(404, 'Session not found.', 'NOT_FOUND');
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  public async clearAll(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      await chatHistoryService.clearAll(auth);
      res.json({ success: true, message: 'Chat history cleared' });
    } catch (err) {
      next(err);
    }
  }
}

export const chatHistoryController = new ChatHistoryController();
