import { StudyPlanModel } from '../models/study_planner.model';

class StudyPlannerRepository {
  private plans: Map<string, StudyPlanModel> = new Map();

  public async savePlan(plan: StudyPlanModel): Promise<StudyPlanModel> {
    this.plans.set(plan.id, plan);
    return plan;
  }

  public async getPlanById(id: string): Promise<StudyPlanModel | undefined> {
    return this.plans.get(id);
  }

  public async getLatestPlan(): Promise<StudyPlanModel | undefined> {
    const all = Array.from(this.plans.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    return all[0];
  }

  public async getAllPlans(): Promise<StudyPlanModel[]> {
    return Array.from(this.plans.values());
  }

  public async deletePlan(id: string): Promise<boolean> {
    return this.plans.delete(id);
  }
}

export const studyPlannerRepository = new StudyPlannerRepository();
