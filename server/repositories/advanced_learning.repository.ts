import { firestoreRest } from '../config/firestore_rest';
import {
  AudioLectureModel,
  ExamPrepGuideModel,
  StudySessionModel,
  TopicMasteryModel,
  VisualDiagramModel,
} from '../models/advanced_learning.model';
import { AuthContext, pickAllowedKeys } from './base.repository';

const STUDY_SESSION_KEYS = [
  'id',
  'userId',
  'notebookId',
  'subject',
  'activityType',
  'startedAt',
  'endedAt',
  'activeDurationSeconds',
  'pausedSeconds',
  'notes',
  'createdAt',
] as const;

const DIAGRAM_KEYS = [
  'id',
  'userId',
  'notebookId',
  'title',
  'diagramType',
  'description',
  'nodes',
  'edges',
  'mermaidSyntax',
  'createdAt',
  'updatedAt',
] as const;

const EXAM_PREP_KEYS = [
  'id',
  'userId',
  'notebookId',
  'subject',
  'examDate',
  'syllabusSummary',
  'topicPlan',
  'importantConcepts',
  'recurringThemes',
  'likelyTopics',
  'practiceQuestions',
  'formulaSheet',
  'revisionChecklist',
  'mockExamQuestions',
  'evidenceSources',
  'uncertaintyNotice',
  'createdAt',
  'updatedAt',
] as const;

const TOPIC_MASTERY_KEYS = [
  'id',
  'userId',
  'notebookId',
  'subject',
  'topic',
  'masteryLevel',
  'difficultyLevel',
  'status',
  'attemptsCount',
  'correctCount',
  'lastReviewedAt',
  'nextReviewDate',
  'struggleNotes',
  'createdAt',
  'updatedAt',
] as const;

const AUDIO_LECTURE_KEYS = [
  'id',
  'userId',
  'notebookId',
  'title',
  'originalFilename',
  'mimeType',
  'fileSizeBytes',
  'durationSeconds',
  'transcriptText',
  'transcriptSegments',
  'speakerNotesAvailable',
  'speakerNotesNotice',
  'summary',
  'keyConcepts',
  'flashcards',
  'quizQuestions',
  'revisionNotes',
  'createdAt',
] as const;

export class AdvancedLearningRepository {
  // ---------------- STUDY SESSIONS ----------------
  public async getStudySessions(auth: AuthContext): Promise<StudySessionModel[]> {
    const list = await firestoreRest.listByUser<StudySessionModel>('study_sessions', auth.userId, auth.idToken);
    return list.sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''));
  }

  public async saveStudySession(session: StudySessionModel, auth: AuthContext): Promise<StudySessionModel> {
    const clean = pickAllowedKeys(
      { ...session, userId: auth.userId },
      STUDY_SESSION_KEYS
    ) as StudySessionModel;
    return firestoreRest.setDoc('study_sessions', clean.id, clean, auth.idToken);
  }

  public async deleteStudySession(id: string, auth: AuthContext): Promise<boolean> {
    const existing = await firestoreRest.getDoc<StudySessionModel>('study_sessions', id, auth.idToken);
    if (!existing || existing.userId !== auth.userId) return false;
    return firestoreRest.deleteDoc('study_sessions', id, auth.idToken);
  }

  // ---------------- VISUAL DIAGRAMS ----------------
  public async getDiagrams(auth: AuthContext, notebookId?: string): Promise<VisualDiagramModel[]> {
    const list = await firestoreRest.listByUser<VisualDiagramModel>('diagrams', auth.userId, auth.idToken);
    const filtered = notebookId ? list.filter((d) => d.notebookId === notebookId) : list;
    return filtered.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }

  public async getDiagramById(id: string, auth: AuthContext): Promise<VisualDiagramModel | null> {
    const doc = await firestoreRest.getDoc<VisualDiagramModel>('diagrams', id, auth.idToken);
    if (!doc || doc.userId !== auth.userId) return null;
    return doc;
  }

  public async saveDiagram(diagram: VisualDiagramModel, auth: AuthContext): Promise<VisualDiagramModel> {
    const clean = pickAllowedKeys(
      {
        ...diagram,
        userId: auth.userId,
        nodes: (diagram.nodes || []).slice(0, 120),
        edges: (diagram.edges || []).slice(0, 250),
        mermaidSyntax: (diagram.mermaidSyntax || '').slice(0, 29000),
      },
      DIAGRAM_KEYS
    ) as VisualDiagramModel;
    return firestoreRest.setDoc('diagrams', clean.id, clean, auth.idToken);
  }

  public async deleteDiagram(id: string, auth: AuthContext): Promise<boolean> {
    const existing = await this.getDiagramById(id, auth);
    if (!existing) return false;
    return firestoreRest.deleteDoc('diagrams', id, auth.idToken);
  }

  // ---------------- EXAM PREP GUIDES ----------------
  public async getExamPrepGuides(auth: AuthContext, notebookId?: string): Promise<ExamPrepGuideModel[]> {
    const list = await firestoreRest.listByUser<ExamPrepGuideModel>('exam_prep_guides', auth.userId, auth.idToken);
    const filtered = notebookId ? list.filter((g) => g.notebookId === notebookId) : list;
    return filtered.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }

  public async getExamPrepGuideById(id: string, auth: AuthContext): Promise<ExamPrepGuideModel | null> {
    const doc = await firestoreRest.getDoc<ExamPrepGuideModel>('exam_prep_guides', id, auth.idToken);
    if (!doc || doc.userId !== auth.userId) return null;
    return doc;
  }

  public async saveExamPrepGuide(guide: ExamPrepGuideModel, auth: AuthContext): Promise<ExamPrepGuideModel> {
    const clean = pickAllowedKeys(
      { ...guide, userId: auth.userId },
      EXAM_PREP_KEYS
    ) as ExamPrepGuideModel;
    return firestoreRest.setDoc('exam_prep_guides', clean.id, clean, auth.idToken);
  }

  public async deleteExamPrepGuide(id: string, auth: AuthContext): Promise<boolean> {
    const existing = await this.getExamPrepGuideById(id, auth);
    if (!existing) return false;
    return firestoreRest.deleteDoc('exam_prep_guides', id, auth.idToken);
  }

  // ---------------- TOPIC MASTERY ----------------
  public async getTopicMasteries(auth: AuthContext): Promise<TopicMasteryModel[]> {
    const list = await firestoreRest.listByUser<TopicMasteryModel>('topic_mastery', auth.userId, auth.idToken);
    return list.sort((a, b) => (a.nextReviewDate || '').localeCompare(b.nextReviewDate || ''));
  }

  public async getTopicMasteryById(id: string, auth: AuthContext): Promise<TopicMasteryModel | null> {
    const doc = await firestoreRest.getDoc<TopicMasteryModel>('topic_mastery', id, auth.idToken);
    if (!doc || doc.userId !== auth.userId) return null;
    return doc;
  }

  public async saveTopicMastery(item: TopicMasteryModel, auth: AuthContext): Promise<TopicMasteryModel> {
    const clean = pickAllowedKeys(
      {
        ...item,
        userId: auth.userId,
        masteryLevel: Math.min(100, Math.max(0, Math.round(item.masteryLevel))),
      },
      TOPIC_MASTERY_KEYS
    ) as TopicMasteryModel;
    return firestoreRest.setDoc('topic_mastery', clean.id, clean, auth.idToken);
  }

  public async deleteTopicMastery(id: string, auth: AuthContext): Promise<boolean> {
    const existing = await this.getTopicMasteryById(id, auth);
    if (!existing) return false;
    return firestoreRest.deleteDoc('topic_mastery', id, auth.idToken);
  }

  // ---------------- AUDIO LECTURES ----------------
  public async getAudioLectures(auth: AuthContext, notebookId?: string): Promise<AudioLectureModel[]> {
    const list = await firestoreRest.listByUser<AudioLectureModel>('audio_lectures', auth.userId, auth.idToken);
    const filtered = notebookId ? list.filter((a) => a.notebookId === notebookId) : list;
    return filtered.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  public async getAudioLectureById(id: string, auth: AuthContext): Promise<AudioLectureModel | null> {
    const doc = await firestoreRest.getDoc<AudioLectureModel>('audio_lectures', id, auth.idToken);
    if (!doc || doc.userId !== auth.userId) return null;
    return doc;
  }

  public async saveAudioLecture(lecture: AudioLectureModel, auth: AuthContext): Promise<AudioLectureModel> {
    const clean = pickAllowedKeys(
      {
        ...lecture,
        userId: auth.userId,
        transcriptText: (lecture.transcriptText || '').slice(0, 195000),
      },
      AUDIO_LECTURE_KEYS
    ) as AudioLectureModel;
    return firestoreRest.setDoc('audio_lectures', clean.id, clean, auth.idToken);
  }

  public async deleteAudioLecture(id: string, auth: AuthContext): Promise<boolean> {
    const existing = await this.getAudioLectureById(id, auth);
    if (!existing) return false;
    return firestoreRest.deleteDoc('audio_lectures', id, auth.idToken);
  }
}

export const advancedLearningRepository = new AdvancedLearningRepository();
