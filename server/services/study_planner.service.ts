import {
  AdjustStudyPlanRequest,
  GenerateStudyPlanRequest,
  StudyDaySchedule,
  StudyPlanModel,
} from '../models/study_planner.model';
import { AuthContext, makeSafeId } from '../repositories/base.repository';
import { studyPlannerRepository } from '../repositories/study_planner.repository';
import { geminiService } from './gemini.service';

export class StudyPlannerService {
  public async generatePlan(
    request: GenerateStudyPlanRequest,
    auth: AuthContext
  ): Promise<StudyPlanModel> {
    const {
      subjects,
      examDate,
      hoursPerDay,
      focusAreas,
      weakTopics = [],
      strongTopics = [],
      preferredStudyTime = 'Morning',
    } = request;

    const now = new Date();
    const targetDate = new Date(examDate);
    const diffTime = Math.max(0, targetDate.getTime() - now.getTime());
    const daysRemaining = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 7);

    const rawData = await geminiService.generateStudyPlan(
      subjects,
      examDate,
      hoursPerDay,
      focusAreas,
      auth,
      {
        weakTopics,
        strongTopics,
        preferredStudyTime,
        daysAvailable: daysRemaining,
      }
    );

    const planId = makeSafeId('plan');

    const schedule: StudyDaySchedule[] = (rawData.schedule || []).map((day: any) => ({
      dayNumber: day.dayNumber || 1,
      date: new Date(now.getTime() + ((day.dayNumber || 1) - 1) * 86400000)
        .toISOString()
        .split('T')[0],
      dayOfWeek: day.dayOfWeek || `Day ${day.dayNumber || 1}`,
      focusSubject: day.focusSubject || subjects[0] || 'General',
      totalHours: day.totalHours || hoursPerDay,
      completed: false,
      notes: day.notes,
      topics: (day.topics || []).map((t: any, idx: number) => ({
        id: `topic-${planId}-${day.dayNumber || 1}-${idx + 1}`,
        subject: t.subject || day.focusSubject,
        topicName: t.topicName || 'Review Chapter',
        estimatedHours: t.estimatedHours || 1,
        priority: t.priority === 'High' || t.priority === 'Low' ? t.priority : 'Medium',
        completed: false,
      })),
    }));

    const plan: StudyPlanModel = {
      id: planId,
      userId: auth.userId,
      title: rawData.title || `Mastery Plan for ${subjects.join(', ')}`,
      subjects,
      weakTopics,
      strongTopics,
      preferredStudyTime,
      examDate,
      hoursPerDay,
      daysRemaining,
      schedule,
      prioritizedTopics: rawData.prioritizedTopics || [],
      adaptiveTips: rawData.adaptiveTips || [],
      overallProgress: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    return studyPlannerRepository.savePlan(plan, auth);
  }

  public async recalibratePlan(
    request: AdjustStudyPlanRequest,
    auth: AuthContext
  ): Promise<StudyPlanModel> {
    const { planId, missedTopics, daysRemaining } = request;
    const existing = await studyPlannerRepository.getPlanById(planId, auth);
    if (!existing) throw new Error('Study plan not found');

    const now = new Date();
    const targetDate = new Date(existing.examDate);
    const actualRemaining = Math.max(
      1,
      daysRemaining ||
        Math.ceil(Math.max(0, targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) ||
        7
    );

    const uncompletedTopicNames =
      missedTopics && missedTopics.length > 0
        ? missedTopics
        : existing.schedule
            .flatMap((d) => d.topics.filter((t) => !t.completed).map((t) => `${t.subject}: ${t.topicName}`))
            .slice(0, 12);

    const rawData = await geminiService.recalibrateStudyPlan(
      existing.title,
      existing.subjects,
      uncompletedTopicNames,
      actualRemaining,
      existing.hoursPerDay,
      auth
    );

    const updatedSchedule: StudyDaySchedule[] = (rawData.schedule || []).map((day: any) => ({
      dayNumber: day.dayNumber || 1,
      date: new Date(now.getTime() + ((day.dayNumber || 1) - 1) * 86400000)
        .toISOString()
        .split('T')[0],
      dayOfWeek: day.dayOfWeek || `Day ${day.dayNumber || 1}`,
      focusSubject: day.focusSubject || existing.subjects[0] || 'General',
      totalHours: day.totalHours || existing.hoursPerDay,
      completed: false,
      notes: day.notes,
      topics: (day.topics || []).map((t: any, idx: number) => ({
        id: `recal-${planId}-${day.dayNumber || 1}-${idx + 1}`,
        subject: t.subject || day.focusSubject,
        topicName: t.topicName || 'Catchup Review',
        estimatedHours: t.estimatedHours || 1,
        priority: t.priority === 'High' || t.priority === 'Low' ? t.priority : 'High',
        completed: false,
      })),
    }));

    existing.schedule = updatedSchedule;
    existing.adaptiveTips = rawData.adaptiveTips || existing.adaptiveTips;
    existing.prioritizedTopics = rawData.prioritizedTopics || existing.prioritizedTopics;
    existing.overallProgress = 0;
    existing.updatedAt = now.toISOString();

    return studyPlannerRepository.savePlan(existing, auth);
  }

  public async toggleTopicCompletion(
    planId: string,
    topicId: string,
    auth: AuthContext
  ): Promise<StudyPlanModel> {
    const plan = await studyPlannerRepository.getPlanById(planId, auth);
    if (!plan) throw new Error('Plan not found');

    let totalTopics = 0;
    let completedTopics = 0;

    plan.schedule.forEach((day) => {
      let allDayDone = true;
      day.topics.forEach((topic) => {
        if (topic.id === topicId) {
          topic.completed = !topic.completed;
        }
        totalTopics++;
        if (topic.completed) completedTopics++;
        else allDayDone = false;
      });
      day.completed = day.topics.length > 0 && allDayDone;
    });

    plan.overallProgress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
    plan.updatedAt = new Date().toISOString();

    return studyPlannerRepository.savePlan(plan, auth);
  }

  public async getAllPlans(auth: AuthContext): Promise<StudyPlanModel[]> {
    return studyPlannerRepository.getAllPlans(auth);
  }

  public async getLatestPlan(auth: AuthContext): Promise<StudyPlanModel | undefined> {
    return studyPlannerRepository.getLatestPlan(auth);
  }

  public async getPlanById(id: string, auth: AuthContext): Promise<StudyPlanModel | undefined> {
    return studyPlannerRepository.getPlanById(id, auth);
  }
}

export const studyPlannerService = new StudyPlannerService();
