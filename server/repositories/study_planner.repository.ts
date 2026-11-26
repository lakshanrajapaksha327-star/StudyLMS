import { firestoreRest } from '../config/firestore_rest';
import { StudyPlanModel } from '../models/study_planner.model';
import { AuthContext, pickAllowedKeys } from './base.repository';

const STUDY_PLAN_KEYS = [
  'id',
  'userId',
  'title',
  'examDate',
  'hoursPerDay',
  'overallProgress',
  'subjects',
  'weakTopics',
  'strongTopics',
  'preferredStudyTime',
  'prioritizedTopics',
  'adaptiveTips',
  'schedule',
  'createdAt',
  'updatedAt',
] as const;

function withComputedDaysRemaining(plan: StudyPlanModel): StudyPlanModel {
  const now = new Date();
  const target = new Date(plan.examDate);
  const diffTime = Math.max(0, target.getTime() - now.getTime());
  const daysRemaining = Number.isFinite(diffTime)
    ? Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
    : 7;
  return { ...plan, daysRemaining };
}

export class StudyPlannerRepository {
  public async savePlan(plan: StudyPlanModel, auth: AuthContext): Promise<StudyPlanModel> {
    const now = new Date().toISOString();
    const payload: StudyPlanModel = {
      ...plan,
      userId: auth.userId,
      createdAt: plan.createdAt || now,
      updatedAt: now,
    };
    const clean = pickAllowedKeys(payload, STUDY_PLAN_KEYS) as StudyPlanModel;
    const saved = await firestoreRest.setDoc('study_plans', clean.id, clean, auth.idToken);
    return withComputedDaysRemaining(saved);
  }

  public async getPlanById(id: string, auth: AuthContext): Promise<StudyPlanModel | undefined> {
    const plan = await firestoreRest.getDoc<StudyPlanModel>('study_plans', id, auth.idToken);
    if (!plan || plan.userId !== auth.userId) return undefined;
    return withComputedDaysRemaining(plan);
  }

  public async getAllPlans(auth: AuthContext): Promise<StudyPlanModel[]> {
    const list = await firestoreRest.listByUser<StudyPlanModel>(
      'study_plans',
      auth.userId,
      auth.idToken
    );
    return list
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
      .map(withComputedDaysRemaining);
  }

  public async getLatestPlan(auth: AuthContext): Promise<StudyPlanModel | undefined> {
    const plans = await this.getAllPlans(auth);
    return plans[0];
  }

  public async deletePlan(id: string, auth: AuthContext): Promise<boolean> {
    const existing = await this.getPlanById(id, auth);
    if (!existing) return false;
    return firestoreRest.deleteDoc('study_plans', id, auth.idToken);
  }
}

export const studyPlannerRepository = new StudyPlannerRepository();
