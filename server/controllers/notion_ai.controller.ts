import { Request, Response } from 'express';
import { getGeminiClient } from '../config/gemini';

export class NotionAiController {
  public async processNoteAction(req: Request, res: Response) {
    try {
      const { action, noteContent, noteTitle } = req.body;
      if (!noteContent) {
        return res.status(400).json({ error: 'Note content is required.' });
      }

      const ai = getGeminiClient();

      let actionPrompt = '';
      switch (action) {
        case 'summarize':
          actionPrompt = 'Create an executive summary and key keypoints for this note.';
          break;
        case 'expand':
          actionPrompt = 'Expand on this note by adding detailed explanations, examples, and context.';
          break;
        case 'extract-key-terms':
          actionPrompt = 'Extract all key definitions, formulas, and terminology into a formatted study list.';
          break;
        case 'fix-grammar':
          actionPrompt = 'Improve clarity, fix grammar, and format nicely into standard markdown.';
          break;
        default:
          actionPrompt = 'Enhance and structure this study note for clear review.';
      }

      const prompt = `You are Notion AI for Study Notes.
Note Title: "${noteTitle || 'Untitled Note'}"
Note Content:
${noteContent}

Task: ${actionPrompt}
Output the refined/expanded note in clear Markdown format.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
      });

      res.json({ result: response.text || '' });
    } catch (error: any) {
      console.error('Notion AI Error:', error);
      res.status(500).json({ error: 'Failed to process note action with Gemini.' });
    }
  }
}

export const notionAiController = new NotionAiController();
