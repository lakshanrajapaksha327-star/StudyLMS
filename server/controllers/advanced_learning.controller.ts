import { Request, Response, NextFunction } from 'express';
import { ApiError, isValidResourceId } from '../middleware/validate.middleware';
import { advancedLearningRepository } from '../repositories/advanced_learning.repository';
import { getAuthContext } from '../repositories/base.repository';
import { advancedLearningService } from '../services/advanced_learning.service';

export class AdvancedLearningController {
  // Personalized Insights
  public async getPersonalizedInsights(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const includeAi = req.query.ai === 'true';
      const data = await advancedLearningService.getPersonalizedInsights(auth, includeAi);
      res.json({ success: true, ...data });
    } catch (err) {
      next(err);
    }
  }

  // Adaptive Learning & Topic Mastery
  public async listTopicMasteries(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const topics = await advancedLearningService.listTopicMasteries(auth);
      res.json({ success: true, topics });
    } catch (err) {
      next(err);
    }
  }

  public async runAdaptiveStep(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { topicMasteryId, notebookId, subject, topic, stage, studentResponse, checkQuestionAsked } =
        req.body || {};
      if (!subject || !String(subject).trim() || !topic || !String(topic).trim()) {
        throw new ApiError(400, 'Subject and topic are required.');
      }
      const result = await advancedLearningService.runAdaptiveTutorStep(
        {
          topicMasteryId: typeof topicMasteryId === 'string' && isValidResourceId(topicMasteryId) ? topicMasteryId : undefined,
          notebookId: typeof notebookId === 'string' && isValidResourceId(notebookId) ? notebookId : undefined,
          subject: String(subject),
          topic: String(topic),
          stage: typeof stage === 'number' ? stage : 1,
          studentResponse: typeof studentResponse === 'string' ? studentResponse : undefined,
          checkQuestionAsked: typeof checkQuestionAsked === 'string' ? checkQuestionAsked : undefined,
        },
        auth
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  public async deleteTopicMastery(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      if (!isValidResourceId(req.params.id)) throw new ApiError(400, 'Invalid topic ID.');
      const deleted = await advancedLearningRepository.deleteTopicMastery(req.params.id, auth);
      if (!deleted) throw new ApiError(404, 'Topic mastery record not found.', 'NOT_FOUND');
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  // Unified Revision Schedule
  public async getRevisionSchedule(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const schedule = await advancedLearningService.getUnifiedRevisionSchedule(auth);
      res.json({ success: true, ...schedule });
    } catch (err) {
      next(err);
    }
  }

  public async rescheduleRevision(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { sourceType, sourceId, newDate } = req.body || {};
      if (!sourceType || !sourceId || !newDate) {
        throw new ApiError(400, 'sourceType, sourceId, and newDate are required.');
      }
      const result = await advancedLearningService.rescheduleRevisionItem(
        { sourceType: String(sourceType), sourceId: String(sourceId), newDate: String(newDate) },
        auth
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  // Smart Exam Preparation Workspace
  public async listExamPrep(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const notebookId = typeof req.query.notebookId === 'string' ? req.query.notebookId : undefined;
      const guides = await advancedLearningService.listExamPrepGuides(auth, notebookId);
      res.json({ success: true, guides });
    } catch (err) {
      next(err);
    }
  }

  public async generateExamPrep(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { notebookId, subject, examDate, syllabusText, pastPaperNotes, selectedDocumentIds } = req.body || {};
      if (!subject || !String(subject).trim() || !examDate || !String(examDate).trim()) {
        throw new ApiError(400, 'Subject and examDate are required.');
      }
      const guide = await advancedLearningService.generateExamPrepGuide(
        {
          notebookId: typeof notebookId === 'string' && isValidResourceId(notebookId) ? notebookId : undefined,
          subject: String(subject),
          examDate: String(examDate),
          syllabusText: typeof syllabusText === 'string' ? syllabusText : undefined,
          pastPaperNotes: typeof pastPaperNotes === 'string' ? pastPaperNotes : undefined,
          selectedDocumentIds: Array.isArray(selectedDocumentIds) ? selectedDocumentIds : undefined,
        },
        auth
      );
      res.status(201).json({ success: true, guide });
    } catch (err) {
      next(err);
    }
  }

  public async updateExamPrepChecklist(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      if (!isValidResourceId(req.params.id)) throw new ApiError(400, 'Invalid exam prep ID.');
      const { revisionChecklist } = req.body || {};
      if (!Array.isArray(revisionChecklist)) throw new ApiError(400, 'revisionChecklist array required.');
      const guide = await advancedLearningService.updateExamPrepChecklist(req.params.id, revisionChecklist, auth);
      res.json({ success: true, guide });
    } catch (err) {
      next(err);
    }
  }

  public async deleteExamPrep(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      if (!isValidResourceId(req.params.id)) throw new ApiError(400, 'Invalid exam prep ID.');
      const deleted = await advancedLearningRepository.deleteExamPrepGuide(req.params.id, auth);
      if (!deleted) throw new ApiError(404, 'Exam prep guide not found.', 'NOT_FOUND');
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  // Visual Learning Studio & Concept Maps
  public async listDiagrams(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const notebookId = typeof req.query.notebookId === 'string' ? req.query.notebookId : undefined;
      const diagrams = await advancedLearningService.listDiagrams(auth, notebookId);
      res.json({ success: true, diagrams });
    } catch (err) {
      next(err);
    }
  }

  public async generateDiagram(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { notebookId, topic, diagramType, selectedDocumentIds } = req.body || {};
      if (!topic || !String(topic).trim()) throw new ApiError(400, 'Diagram topic is required.');
      const diagram = await advancedLearningService.generateInteractiveDiagram(
        {
          notebookId: typeof notebookId === 'string' && isValidResourceId(notebookId) ? notebookId : undefined,
          topic: String(topic),
          diagramType: String(diagramType || 'concept_map'),
          selectedDocumentIds: Array.isArray(selectedDocumentIds) ? selectedDocumentIds : undefined,
        },
        auth
      );
      res.status(201).json({ success: true, diagram });
    } catch (err) {
      next(err);
    }
  }

  public async saveDiagram(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { id, notebookId, title, diagramType, description, nodes, edges, mermaidSyntax } = req.body || {};
      if (!title || !String(title).trim()) throw new ApiError(400, 'Diagram title is required.');
      const diagram = await advancedLearningService.saveDiagram(
        {
          id: typeof id === 'string' && isValidResourceId(id) ? id : undefined,
          notebookId: typeof notebookId === 'string' && isValidResourceId(notebookId) ? notebookId : undefined,
          title: String(title),
          diagramType: typeof diagramType === 'string' ? diagramType : undefined,
          description: typeof description === 'string' ? description : undefined,
          nodes,
          edges,
          mermaidSyntax: typeof mermaidSyntax === 'string' ? mermaidSyntax : undefined,
        },
        auth
      );
      res.json({ success: true, diagram });
    } catch (err) {
      next(err);
    }
  }

  public async deleteDiagram(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      if (!isValidResourceId(req.params.id)) throw new ApiError(400, 'Invalid diagram ID.');
      const deleted = await advancedLearningRepository.deleteDiagram(req.params.id, auth);
      if (!deleted) throw new ApiError(404, 'Diagram not found.', 'NOT_FOUND');
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  // Audio Lecture Assistant
  public async listAudioLectures(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const notebookId = typeof req.query.notebookId === 'string' ? req.query.notebookId : undefined;
      const lectures = await advancedLearningService.listAudioLectures(auth, notebookId);
      res.json({ success: true, lectures });
    } catch (err) {
      next(err);
    }
  }

  public async uploadAudioLecture(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const title = typeof req.body?.title === 'string' ? req.body.title : undefined;
      const notebookId =
        typeof req.body?.notebookId === 'string' && isValidResourceId(req.body.notebookId)
          ? req.body.notebookId
          : undefined;
      const durationSeconds = req.body?.durationSeconds ? Number(req.body.durationSeconds) : undefined;

      const lecture = await advancedLearningService.processAudioLectureUpload(
        req.file,
        { title, notebookId, durationSeconds },
        auth
      );
      res.status(201).json({ success: true, lecture });
    } catch (err) {
      next(err);
    }
  }

  public async deleteAudioLecture(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      if (!isValidResourceId(req.params.id)) throw new ApiError(400, 'Invalid audio lecture ID.');
      const deleted = await advancedLearningRepository.deleteAudioLecture(req.params.id, auth);
      if (!deleted) throw new ApiError(404, 'Audio lecture not found.', 'NOT_FOUND');
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  // Study Session Tracker
  public async listStudySessions(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const sessions = await advancedLearningService.listStudySessions(auth);
      res.json({ success: true, sessions });
    } catch (err) {
      next(err);
    }
  }

  public async createStudySession(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { notebookId, subject, activityType, startedAt, endedAt, activeDurationSeconds, pausedSeconds, notes } =
        req.body || {};
      if (typeof activeDurationSeconds !== 'number' || activeDurationSeconds <= 0) {
        throw new ApiError(400, 'activeDurationSeconds must be a positive number.');
      }
      const session = await advancedLearningService.recordStudySession(
        {
          notebookId: typeof notebookId === 'string' && isValidResourceId(notebookId) ? notebookId : undefined,
          subject: String(subject || 'General Study'),
          activityType,
          startedAt: String(startedAt || new Date().toISOString()),
          endedAt: String(endedAt || new Date().toISOString()),
          activeDurationSeconds,
          pausedSeconds: typeof pausedSeconds === 'number' ? pausedSeconds : 0,
          notes: typeof notes === 'string' ? notes : undefined,
        },
        auth
      );
      res.status(201).json({ success: true, session });
    } catch (err) {
      next(err);
    }
  }

  public async deleteStudySession(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      if (!isValidResourceId(req.params.id)) throw new ApiError(400, 'Invalid study session ID.');
      const deleted = await advancedLearningRepository.deleteStudySession(req.params.id, auth);
      if (!deleted) throw new ApiError(404, 'Study session not found.', 'NOT_FOUND');
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  // Learning Analytics
  public async getAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const rawRange = String(req.query.range || '30d');
      const range =
        rawRange === '7d' || rawRange === '30d' || rawRange === '90d' || rawRange === 'all'
          ? rawRange
          : '30d';
      const analytics = await advancedLearningService.getLearningAnalytics(auth, range);
      res.json({ success: true, ...analytics });
    } catch (err) {
      next(err);
    }
  }
}

export const advancedLearningController = new AdvancedLearningController();
