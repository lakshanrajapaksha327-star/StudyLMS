import {
  GenerateStudyPlanRequest,
  AdjustStudyPlanRequest,
  StudyPlanModel,
  StudyDaySchedule,
} from '../models/study_planner.model';
import { geminiService } from './gemini.service';
import { studyPlannerRepository } from '../repositories/study_planner.repository';

export class StudyPlannerService {
  public async generatePlan(request: GenerateStudyPlanRequest): Promise<StudyPlanModel> {
    const { subjects, examDate, hoursPerDay, focusAreas } = request;

    const rawData = await geminiService.generateStudyPlan(
      subjects,
      examDate,
      hoursPerDay,
      focusAreas
    );

    const now = new Date();
    const targetDate = new Date(examDate);
    const diffTime = Math.max(0, targetDate.getTime() - now.getTime());
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 7;

    const planId = `plan-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Add unique IDs and state to topics
    const schedule: StudyDaySchedule[] = (rawData.schedule || []).map((day: any) => ({
      dayNumber: day.dayNumber || 1,
      date: new Date(now.getTime() + (day.dayNumber - 1) * 86400000).toISOString().split('T')[0],
      dayOfWeek: day.dayOfWeek || 'Day ' + day.dayNumber,
      focusSubject: day.focusSubject || subjects[0] || 'General',
      totalHours: day.totalHours || hoursPerDay,
      completed: false,
      notes: day.notes,
      topics: (day.topics || []).map((t: any, idx: number) => ({
        id: `topic-${planId}-${day.dayNumber}-${idx + 1}`,
        subject: t.subject || day.focusSubject,
        topicName: t.topicName || 'Review Chapter',
        estimatedHours: t.estimatedHours || 1,
        priority: t.priority === 'High' || t.priority === 'Low' ? t.priority : 'Medium',
        completed: false,
      })),
    }));

    const plan: StudyPlanModel = {
      id: planId,
      title: rawData.title || `Mastery Plan for ${subjects.join(', ')}`,
      subjects,
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

    await studyPlannerRepository.savePlan(plan);
    return plan;
  }

  public async recalibratePlan(request: AdjustStudyPlanRequest): Promise<StudyPlanModel> {
    const { planId, missedTopics, daysRemaining } = request;
    const existing = await studyPlannerRepository.getPlanById(planId);

    if (!existing) {
      throw new Error('Study plan not found');
    }

    const rawData = await geminiService.recalibrateStudyPlan(
      existing.title,
      existing.subjects,
      missedTopics,
      daysRemaining || existing.daysRemaining,
      existing.hoursPerDay
    );

    const now = new Date();
    const updatedSchedule: StudyDaySchedule[] = (rawData.schedule || []).map((day: any) => ({
      dayNumber: day.dayNumber || 1,
      date: new Date(now.getTime() + (day.dayNumber - 1) * 86400000).toISOString().split('T')[0],
      dayOfWeek: day.dayOfWeek || 'Day ' + day.dayNumber,
      focusSubject: day.focusSubject || existing.subjects[0] || 'General',
      totalHours: day.totalHours || existing.hoursPerDay,
      completed: false,
      notes: day.notes,
      topics: (day.topics || []).map((t: any, idx: number) => ({
        id: `recal-topic-${planId}-${day.dayNumber}-${idx + 1}`,
        subject: t.subject || day.focusSubject,
        topicName: t.topicName || 'Catchup Review',
        estimatedHours: t.estimatedHours || 1,
        priority: t.priority || 'High',
        completed: false,
      })),
    }));

    existing.schedule = updatedSchedule;
    existing.adaptiveTips = rawData.adaptiveTips || existing.adaptiveTips;
    existing.prioritizedTopics = rawData.prioritizedTopics || existing.prioritizedTopics;
    existing.updatedAt = now.toISOString();

    await studyPlannerRepository.savePlan(existing);
    return existing;
  }

  public async toggleTopicCompletion(planId: string, topicId: string): Promise<StudyPlanModel> {
    const plan = await studyPlannerRepository.getPlanById(planId);
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

    await studyPlannerRepository.savePlan(plan);
    return plan;
  }

  public async getLatestPlan(): Promise<StudyPlanModel | undefined> {
    return studyPlannerRepository.getLatestPlan();
  }

  public async getPlanById(id: string): Promise<StudyPlanModel | undefined> {
    return studyPlannerRepository.getPlanById(id);
  }
}

export const studyPlannerService = new StudyPlannerService();
