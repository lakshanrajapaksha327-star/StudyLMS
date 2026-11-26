import { Request, Response, NextFunction } from 'express';
import { aiManagerService } from '../ai/ai-manager.service';
import { ApiError } from '../middleware/validate.middleware';
import { getAuthContext } from '../repositories/base.repository';
import { workspaceRepository } from '../repositories/workspace.repository';
import { geminiService, SummaryGenerationMode } from '../services/gemini.service';
import { ragService } from '../services/rag.service';

export class AiAdvancedController {
  public async transformText(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { text, action, option } = req.body;
      if (!text || !String(text).trim()) {
        throw new ApiError(400, 'Text selection is required.');
      }
      const result = await geminiService.transformText(
        String(text),
        action || 'explain',
        option,
        auth
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  public async generateCitations(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { title, author, year, publisherUrl } = req.body;
      if (!title) throw new ApiError(400, 'Title is required.');
      const citations = await geminiService.generateCitations(
        title,
        author,
        year,
        publisherUrl,
        auth
      );
      res.json({ success: true, citations });
    } catch (err) {
      next(err);
    }
  }

  public async solveFormula(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { formula, givenVariables } = req.body;
      if (!formula || !String(formula).trim()) {
        throw new ApiError(400, 'Formula expression is required.');
      }
      const result = await geminiService.solveFormula(String(formula), givenVariables, auth);
      res.json({ success: true, solution: result });
    } catch (err) {
      next(err);
    }
  }

  public async analyzeCode(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { code, language } = req.body;
      if (!code || !String(code).trim()) {
        throw new ApiError(400, 'Code snippet is required.');
      }
      const result = await geminiService.analyzeCodeAndFindBugs(
        String(code),
        language || 'auto',
        auth
      );
      res.json({ success: true, analysis: result });
    } catch (err) {
      next(err);
    }
  }

  public async getHealth(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      void auth;
      const monitoring = aiManagerService.getMonitoringOverview();
      res.json({ success: true, ...monitoring });
    } catch (err) {
      next(err);
    }
  }

  public async generateSummaryMode(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { mode = 'detailed', title, sourceContent, notebookId, selectedDocumentIds } = req.body || {};

      let material = typeof sourceContent === 'string' ? sourceContent : '';
      let citations: any[] = [];

      if (!material.trim()) {
        const rag = await ragService.retrieveContext({
          query: `Summarize key themes, definitions, formulas, and facts for ${title || 'study materials'}`,
          auth,
          notebookId,
          selectedDocumentIds,
          topK: 14,
          maxContextTokens: 9000,
        });
        material = rag.formattedContext;
        citations = rag.citations;
      }

      if (!material.trim()) {
        throw new ApiError(400, 'Select a document, upload content, or provide text to summarize.');
      }

      const summaryResult = await geminiService.generateStructuredSummary({
        mode: mode as SummaryGenerationMode,
        title: String(title || 'Study Material Summary'),
        sourceContent: material,
        auth,
      });

      await workspaceRepository
        .addActivityLog(
          {
            type: 'summary_generated',
            title: `${String(title || 'Document')} (${mode})`,
            details: `Generated ${mode} summary across ${citations.length || 1} source excerpt(s)`,
          },
          auth
        )
        .catch(() => {});

      res.json({
        success: true,
        summary: summaryResult,
        citations,
      });
    } catch (err) {
      next(err);
    }
  }

  public async predictExam(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { sourcesContent, syllabusNotes, pastPaperNotes, notebookId, selectedDocumentIds } =
        req.body;
      let material = typeof sourcesContent === 'string' ? sourcesContent : '';

      if (!material.trim()) {
        const rag = await ragService.retrieveContext({
          query: 'key concepts, formulas, theorems, and exam topics across study materials',
          auth,
          notebookId,
          selectedDocumentIds,
          topK: 12,
        });
        material = rag.formattedContext;
      }

      if (!material.trim() && !String(syllabusNotes || '').trim() && !String(pastPaperNotes || '').trim()) {
        throw new ApiError(400, 'Study materials content, syllabus, or indexed documents required.');
      }

      const result = await geminiService.predictExamQuestions(
        material || 'Use provided syllabus and past paper notes.',
        auth,
        typeof syllabusNotes === 'string' ? syllabusNotes : undefined,
        typeof pastPaperNotes === 'string' ? pastPaperNotes : undefined
      );
      res.json({ success: true, examPredictions: result });
    } catch (err) {
      next(err);
    }
  }

  public async multiDocSynthesis(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { documents, documentIds, notebookId, query, mode } = req.body;
      if (!query || !String(query).trim()) {
        throw new ApiError(400, 'Query is required.');
      }

      // First try persistent vector RAG across selected documents / notebook
      const selectedDocumentIds = Array.isArray(documentIds)
        ? documentIds
        : Array.isArray(documents)
        ? documents.map((d: any) => d.id).filter(Boolean)
        : undefined;

      const rag = await ragService.retrieveContext({
        query: String(query),
        auth,
        notebookId,
        selectedDocumentIds,
        topK: 12,
        maxContextTokens: 8000,
      });

      let contextText = rag.formattedContext;
      let sourceTitles = Array.from(new Set(rag.citations.map((c) => c.documentTitle)));

      if (!rag.hasEvidence && Array.isArray(documents) && documents.length > 0) {
        contextText = documents
          .filter((d: any) => d.content && String(d.content).trim())
          .map(
            (d: any, idx: number) =>
              `=== Source #${idx + 1}: "${d.title || 'Document'}" ===\n${String(d.content).slice(0, 12000)}`
          )
          .join('\n\n');
        sourceTitles = documents.map((d: any) => d.title || 'Document');
      }

      if (!contextText.trim()) {
        return res.json({
          success: true,
          synthesis: {
            synthesisAnswer:
              'I could not find sufficient supporting information in your uploaded study materials.',
            sourcesAnalyzed: [],
            citations: [],
          },
        });
      }

      const result = await geminiService.synthesizeMultiDocuments({
        retrievedContext: contextText,
        sourceTitles,
        userQuery: String(query),
        mode: mode || 'synthesis',
        auth,
      });

      res.json({
        success: true,
        synthesis: {
          ...result,
          citations: rag.citations,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  public async generateSlides(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { topic, content, slideCount, notebookId, selectedDocumentIds } = req.body;
      if (!topic) throw new ApiError(400, 'Topic is required.');

      let refContent = typeof content === 'string' ? content : '';
      if (!refContent.trim()) {
        const rag = await ragService.retrieveContext({
          query: String(topic),
          auth,
          notebookId,
          selectedDocumentIds,
          topK: 8,
        });
        refContent = rag.formattedContext;
      }

      const deck = await geminiService.generatePowerPointSlides(
        String(topic),
        refContent,
        Number(slideCount) || 5,
        auth
      );
      res.json({ success: true, deck });
    } catch (err) {
      next(err);
    }
  }

  public async generateDiagram(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { topic, diagramType } = req.body;
      if (!topic) throw new ApiError(400, 'Topic is required.');
      const diagram = await geminiService.generateDiagram(
        String(topic),
        diagramType || 'flowchart',
        auth
      );
      res.json({ success: true, diagram });
    } catch (err) {
      next(err);
    }
  }

  public async generateCheatSheet(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { topic, content, notebookId, selectedDocumentIds } = req.body;
      if (!topic) throw new ApiError(400, 'Topic is required.');

      let refContent = typeof content === 'string' ? content : '';
      if (!refContent.trim()) {
        const rag = await ragService.retrieveContext({
          query: String(topic),
          auth,
          notebookId,
          selectedDocumentIds,
          topK: 8,
        });
        refContent = rag.formattedContext;
      }

      const cheatSheet = await geminiService.generateCheatSheet(String(topic), refContent, auth);
      res.json({ success: true, cheatSheet });
    } catch (err) {
      next(err);
    }
  }

  public async generateMnemonics(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { topic, itemsToRemember } = req.body;
      if (!topic) throw new ApiError(400, 'Topic is required.');
      const mnemonics = await geminiService.generateMnemonics(
        String(topic),
        itemsToRemember || [],
        auth
      );
      res.json({ success: true, ...mnemonics });
    } catch (err) {
      next(err);
    }
  }

  public async generateVivaQuestions(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { subject } = req.body;
      if (!subject) throw new ApiError(400, 'Subject is required.');
      const questions = await geminiService.generateVivaQuestions(String(subject), auth);
      res.json({ success: true, questions });
    } catch (err) {
      next(err);
    }
  }

  public async evaluateVivaAnswer(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { question, studentAnswer, expectedKeywords } = req.body;
      if (!question || !studentAnswer) {
        throw new ApiError(400, 'Question and student answer are required.');
      }
      const evaluation = await geminiService.evaluateVivaAnswer(
        String(question),
        String(studentAnswer),
        expectedKeywords || [],
        auth
      );
      res.json({ success: true, evaluation });
    } catch (err) {
      next(err);
    }
  }
}

export const aiAdvancedController = new AiAdvancedController();
