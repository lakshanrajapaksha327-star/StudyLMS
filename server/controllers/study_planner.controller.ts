import { Request, Response, NextFunction } from 'express';
import { ApiError, isValidResourceId } from '../middleware/validate.middleware';
import { getAuthContext } from '../repositories/base.repository';
import { studyPlannerService } from '../services/study_planner.service';

export class StudyPlannerController {
  public async generatePlan(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const {
        subjects,
        examDate,
        hoursPerDay,
        focusAreas,
        weakTopics,
        strongTopics,
        preferredStudyTime,
      } = req.body;
      if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
        throw new ApiError(400, 'At least one subject is required.');
      }
      if (!examDate) {
        throw new ApiError(400, 'Exam date is required.');
      }

      const plan = await studyPlannerService.generatePlan(
        {
          subjects,
          examDate,
          hoursPerDay: Number(hoursPerDay) || 3,
          focusAreas,
          weakTopics: Array.isArray(weakTopics) ? weakTopics : [],
          strongTopics: Array.isArray(strongTopics) ? strongTopics : [],
          preferredStudyTime:
            typeof preferredStudyTime === 'string' ? preferredStudyTime : undefined,
        },
        auth
      );
      res.json({ success: true, plan });
    } catch (err) {
      next(err);
    }
  }

  public async recalibratePlan(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { planId, missedTopics, daysRemaining } = req.body;
      if (!planId || !isValidResourceId(planId)) throw new ApiError(400, 'Valid Plan ID required.');

      const updatedPlan = await studyPlannerService.recalibratePlan(
        {
          planId,
          missedTopics: missedTopics || [],
          completedTopicIds: [],
          daysRemaining: Number(daysRemaining) || 7,
        },
        auth
      );
      res.json({ success: true, plan: updatedPlan });
    } catch (err) {
      next(err);
    }
  }

  public async toggleTopic(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { planId, topicId } = req.body;
      if (!planId || !topicId) throw new ApiError(400, 'planId and topicId are required.');

      const updatedPlan = await studyPlannerService.toggleTopicCompletion(planId, topicId, auth);
      res.json({ success: true, plan: updatedPlan });
    } catch (err) {
      next(err);
    }
  }

  public async getAllPlans(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const plans = await studyPlannerService.getAllPlans(auth);
      res.json({ success: true, plans });
    } catch (err) {
      next(err);
    }
  }

  public async getLatestPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const plan = await studyPlannerService.getLatestPlan(auth);
      res.json({ success: true, plan: plan || null });
    } catch (err) {
      next(err);
    }
  }

  public async getPlanById(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      if (!isValidResourceId(req.params.id)) throw new ApiError(400, 'Invalid plan ID.');
      const plan = await studyPlannerService.getPlanById(req.params.id, auth);
      if (!plan) throw new ApiError(404, 'Plan not found.', 'NOT_FOUND');
      res.json({ success: true, plan });
    } catch (err) {
      next(err);
    }
  }
}

export const studyPlannerController = new StudyPlannerController();
