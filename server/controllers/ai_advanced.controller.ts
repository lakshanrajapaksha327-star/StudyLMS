import { Request, Response } from 'express';
import { geminiService } from '../services/gemini.service';
import { aiPromptRepository } from '../repositories/ai_prompt.repository';

export class AiAdvancedController {
  public async transformText(req: Request, res: Response) {
    try {
      const { text, action, option } = req.body;
      if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Text selection is required' });
      }

      const startTime = Date.now();
      const result = await geminiService.transformText(text, action || 'explain', option);
      const latencyMs = Date.now() - startTime;

      // Log AI Prompt
      await aiPromptRepository.logPrompt({
        userId: '1',
        feature: 'notion_ai',
        prompt: `Action: ${action}, Option: ${option}, Text: ${text.slice(0, 100)}...`,
        response: result.resultText.slice(0, 200),
        latencyMs,
        costUsd: 0.0001,
        tokensConsumed: Math.round((text.length + result.resultText.length) / 4),
        modelName: 'gemini-3.6-flash',
      });

      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to transform selected text', details: error?.message });
    }
  }

  public async generateCitations(req: Request, res: Response) {
    try {
      const { title, author, year, publisherUrl } = req.body;
      if (!title) return res.status(400).json({ error: 'Title is required' });

      const citations = await geminiService.generateCitations(title, author, year, publisherUrl);
      res.json({ success: true, citations });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to generate citations' });
    }
  }

  public async solveFormula(req: Request, res: Response) {
    try {
      const { formula, givenVariables } = req.body;
      if (!formula || !formula.trim()) {
        return res.status(400).json({ error: 'Formula expression is required' });
      }

      const startTime = Date.now();
      const result = await geminiService.solveFormula(formula, givenVariables);
      const latencyMs = Date.now() - startTime;

      await aiPromptRepository.logPrompt({
        userId: '1',
        feature: 'notion_ai',
        prompt: `Formula: ${formula}`,
        response: JSON.stringify(result).slice(0, 200),
        latencyMs,
        costUsd: 0.0002,
        tokensConsumed: 350,
        modelName: 'gemini-3.6-flash',
      });

      res.json({ success: true, solution: result });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to solve formula step-by-step' });
    }
  }

  public async analyzeCode(req: Request, res: Response) {
    try {
      const { code, language } = req.body;
      if (!code || !code.trim()) {
        return res.status(400).json({ error: 'Code snippet is required' });
      }

      const result = await geminiService.analyzeCodeAndFindBugs(code, language || 'auto');
      res.json({ success: true, analysis: result });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to analyze code and detect bugs' });
    }
  }

  public async predictExam(req: Request, res: Response) {
    try {
      const { sourcesContent } = req.body;
      if (!sourcesContent || !sourcesContent.trim()) {
        return res.status(400).json({ error: 'Study materials content is required' });
      }

      const result = await geminiService.predictExamQuestions(sourcesContent);
      res.json({ success: true, examPredictions: result });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to predict probable exam questions' });
    }
  }

  public async multiDocSynthesis(req: Request, res: Response) {
    try {
      const { documents, query } = req.body;
      if (!documents || !Array.isArray(documents) || documents.length === 0) {
        return res.status(400).json({ error: 'At least one document is required' });
      }
      if (!query || !query.trim()) {
        return res.status(400).json({ error: 'Query is required' });
      }

      const result = await geminiService.synthesizeMultiDocuments(documents, query);
      res.json({ success: true, synthesis: result });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to synthesize multi-document response' });
    }
  }

  public async generateSlides(req: Request, res: Response) {
    try {
      const { topic, content, slideCount } = req.body;
      if (!topic) return res.status(400).json({ error: 'Topic is required' });
      const deck = await geminiService.generatePowerPointSlides(topic, content || '', slideCount || 5);
      res.json({ success: true, deck });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to generate presentation slides' });
    }
  }

  public async generateDiagram(req: Request, res: Response) {
    try {
      const { topic, diagramType } = req.body;
      if (!topic) return res.status(400).json({ error: 'Topic is required' });
      const diagram = await geminiService.generateDiagram(topic, diagramType || 'flowchart');
      res.json({ success: true, diagram });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to generate diagram' });
    }
  }

  public async generateCheatSheet(req: Request, res: Response) {
    try {
      const { topic, content } = req.body;
      if (!topic) return res.status(400).json({ error: 'Topic is required' });
      const cheatSheet = await geminiService.generateCheatSheet(topic, content || '');
      res.json({ success: true, cheatSheet });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to generate cheat sheet' });
    }
  }

  public async generateMnemonics(req: Request, res: Response) {
    try {
      const { topic, itemsToRemember } = req.body;
      if (!topic) return res.status(400).json({ error: 'Topic is required' });
      const mnemonics = await geminiService.generateMnemonics(topic, itemsToRemember || []);
      res.json({ success: true, ...mnemonics });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to generate mnemonics' });
    }
  }

  public async generateVivaQuestions(req: Request, res: Response) {
    try {
      const { subject } = req.body;
      if (!subject) return res.status(400).json({ error: 'Subject is required' });
      const questions = await geminiService.generateVivaQuestions(subject);
      res.json({ success: true, questions });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to generate viva questions' });
    }
  }

  public async evaluateVivaAnswer(req: Request, res: Response) {
    try {
      const { question, studentAnswer, expectedKeywords } = req.body;
      if (!question || !studentAnswer) {
        return res.status(400).json({ error: 'Question and student answer are required' });
      }
      const evaluation = await geminiService.evaluateVivaAnswer(question, studentAnswer, expectedKeywords || []);
      res.json({ success: true, evaluation });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to evaluate viva response' });
    }
  }
}

export const aiAdvancedController = new AiAdvancedController();
