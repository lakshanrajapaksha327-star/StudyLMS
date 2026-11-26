import { Request, Response, NextFunction } from 'express';
import { aiManagerService } from '../ai/ai-manager.service';
import { ApiError } from '../middleware/validate.middleware';
import { getAuthContext } from '../repositories/base.repository';

export class NotionAiController {
  public async processNoteAction(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { action, noteContent, noteTitle } = req.body;
      if (!noteContent || !String(noteContent).trim()) {
        throw new ApiError(400, 'Note content is required.');
      }

      const actionMap: Record<string, { prompt: string; taskType: 'simple_text' | 'complex_reasoning' }> = {
        improve: {
          prompt:
            'Improve clarity, structure, flow, and academic rigor while preserving all factual meaning.',
          taskType: 'complex_reasoning',
        },
        explain: {
          prompt:
            'Explain the concepts inside this study note clearly with intuitive intuition, examples, and key takeaways.',
          taskType: 'complex_reasoning',
        },
        summarize: {
          prompt:
            'Create an executive summary and key bullet takeaways for this note.',
          taskType: 'simple_text',
        },
        simplify: {
          prompt:
            'Rewrite and simplify this note into plain, beginner-friendly language with everyday analogies without omitting core ideas.',
          taskType: 'simple_text',
        },
        expand: {
          prompt:
            'Expand on this note with deeper academic explanations, worked examples, and key context.',
          taskType: 'complex_reasoning',
        },
        examples: {
          prompt:
            'Add concrete real-world and exam-relevant worked examples illustrating each major concept in this note.',
          taskType: 'complex_reasoning',
        },
        'extract-key-terms': {
          prompt:
            'Extract key definitions, formulas, and technical terms into a clear formatted glossary.',
          taskType: 'simple_text',
        },
        'fix-grammar': {
          prompt:
            'Fix grammar, spelling, punctuation, and Markdown formatting cleanly without altering technical meaning.',
          taskType: 'simple_text',
        },
      };

      const selected = actionMap[String(action || 'improve')] || actionMap.improve;

      const prompt = `You are a Notion-style AI Writing & Study Assistant.
Note Title: "${noteTitle || 'Untitled Note'}"
Note Content:
${String(noteContent).slice(0, 24000)}

Task: ${selected.prompt}
Output clean, well-structured Markdown.`;

      const managed = await aiManagerService.generate({
        taskType: selected.taskType,
        feature: 'notion_ai',
        promptSummary: `Note AI (${action || 'improve'}): ${noteTitle || 'Untitled'}`,
        auth,
        contents: prompt,
      });

      res.json({
        success: true,
        result: managed.text || '',
        provider: managed.provider,
        model: managed.model,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const notionAiController = new NotionAiController();
