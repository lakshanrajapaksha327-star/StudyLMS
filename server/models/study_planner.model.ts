export interface StudyTopic {
  id: string;
  subject: string;
  topicName: string;
  estimatedHours: number;
  priority: 'High' | 'Medium' | 'Low';
  completed: boolean;
}

export interface StudyDaySchedule {
  dayNumber: number;
  date: string;
  dayOfWeek: string;
  focusSubject: string;
  topics: StudyTopic[];
  totalHours: number;
  completed: boolean;
  notes?: string;
}

export interface StudyPlanModel {
  id: string;
  title: string;
  subjects: string[];
  examDate: string;
  hoursPerDay: number;
  daysRemaining: number;
  schedule: StudyDaySchedule[];
  prioritizedTopics: string[];
  adaptiveTips: string[];
  overallProgress: number; // percentage
  createdAt: string;
  updatedAt: string;
}

export interface GenerateStudyPlanRequest {
  subjects: string[];
  examDate: string;
  hoursPerDay: number;
  focusAreas?: string;
  studyDaysPerWeek?: number;
}

export interface AdjustStudyPlanRequest {
  planId: string;
  missedTopics: string[];
  completedTopicIds: string[];
  daysRemaining: number;
}
