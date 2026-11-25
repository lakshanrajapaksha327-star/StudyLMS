import { Request, Response } from 'express';
import { chatHistoryService } from '../services/chat_history.service';

export class ChatHistoryController {
  public async getSessions(req: Request, res: Response) {
    try {
      const sessions = await chatHistoryService.getSessions();
      res.json({ success: true, sessions });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to retrieve chat history sessions' });
    }
  }

  public async getSessionById(req: Request, res: Response) {
    try {
      const session = await chatHistoryService.getSessionById(req.params.id);
      if (!session) return res.status(404).json({ error: 'Chat session not found' });
      res.json({ success: true, session });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to retrieve chat session' });
    }
  }

  public async createSession(req: Request, res: Response) {
    try {
      const { title, messages, persona, notebookId } = req.body;
      const session = await chatHistoryService.createSession(
        title || 'New Study Session',
        messages || [],
        persona,
        notebookId
      );
      res.json({ success: true, session });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to create chat history session' });
    }
  }

  public async searchSessions(req: Request, res: Response) {
    try {
      const q = (req.query.q as string) || '';
      const sessions = await chatHistoryService.searchSessions(q);
      res.json({ success: true, sessions });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to search chat sessions' });
    }
  }

  public async renameSession(req: Request, res: Response) {
    try {
      const { title } = req.body;
      if (!title || !title.trim()) return res.status(400).json({ error: 'Title required' });
      const session = await chatHistoryService.renameSession(req.params.id, title.trim());
      if (!session) return res.status(404).json({ error: 'Session not found' });
      res.json({ success: true, session });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to rename chat session' });
    }
  }

  public async archiveSession(req: Request, res: Response) {
    try {
      const { isArchived = true } = req.body;
      const session = await chatHistoryService.archiveSession(req.params.id, Boolean(isArchived));
      if (!session) return res.status(404).json({ error: 'Session not found' });
      res.json({ success: true, session });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to archive chat session' });
    }
  }

  public async deleteSession(req: Request, res: Response) {
    try {
      const success = await chatHistoryService.deleteSession(req.params.id);
      res.json({ success });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to delete chat history session' });
    }
  }

  public async clearAll(req: Request, res: Response) {
    try {
      await chatHistoryService.clearAll();
      res.json({ success: true, message: 'Chat history cleared' });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to clear chat history' });
    }
  }
}

export const chatHistoryController = new ChatHistoryController();
