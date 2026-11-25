import { Request, Response } from 'express';
import { studyPlannerService } from '../services/study_planner.service';

export class StudyPlannerController {
  public async generatePlan(req: Request, res: Response) {
    try {
      const { subjects, examDate, hoursPerDay, focusAreas } = req.body;
      if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
        return res.status(400).json({ error: 'At least one subject is required.' });
      }
      if (!examDate) {
        return res.status(400).json({ error: 'Exam date is required.' });
      }

      const plan = await studyPlannerService.generatePlan({
        subjects,
        examDate,
        hoursPerDay: Number(hoursPerDay) || 3,
        focusAreas,
      });

      res.json({ success: true, plan });
    } catch (error: any) {
      console.error('StudyPlannerController Generate Error:', error);
      res.status(500).json({
        error: 'Failed to generate study plan with AI',
        details: error?.message || String(error),
      });
    }
  }

  public async recalibratePlan(req: Request, res: Response) {
    try {
      const { planId, missedTopics, daysRemaining } = req.body;
      if (!planId) return res.status(400).json({ error: 'Plan ID required.' });

      const updatedPlan = await studyPlannerService.recalibratePlan({
        planId,
        missedTopics: missedTopics || [],
        completedTopicIds: [],
        daysRemaining: Number(daysRemaining) || 7,
      });

      res.json({ success: true, plan: updatedPlan });
    } catch (error: any) {
      console.error('StudyPlannerController Recalibrate Error:', error);
      res.status(500).json({ error: 'Failed to recalibrate study plan with AI.' });
    }
  }

  public async toggleTopic(req: Request, res: Response) {
    try {
      const { planId, topicId } = req.body;
      if (!planId || !topicId) {
        return res.status(400).json({ error: 'planId and topicId are required.' });
      }

      const updatedPlan = await studyPlannerService.toggleTopicCompletion(planId, topicId);
      res.json({ success: true, plan: updatedPlan });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to update topic status.' });
    }
  }

  public async getLatestPlan(req: Request, res: Response) {
    try {
      const plan = await studyPlannerService.getLatestPlan();
      res.json({ success: true, plan });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to retrieve study plan.' });
    }
  }

  public async getPlanById(req: Request, res: Response) {
    try {
      const plan = await studyPlannerService.getPlanById(req.params.id);
      if (!plan) return res.status(404).json({ error: 'Plan not found.' });
      res.json({ success: true, plan });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to retrieve study plan.' });
    }
  }
}

export const studyPlannerController = new StudyPlannerController();
