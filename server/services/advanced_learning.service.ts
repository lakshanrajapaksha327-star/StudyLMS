import { aiManagerService } from '../ai/ai-manager.service';
import { ApiError } from '../middleware/validate.middleware';
import {
  AudioLectureModel,
  ExamPrepGuideModel,
  StudySessionModel,
  TopicMasteryModel,
  VisualDiagramModel,
} from '../models/advanced_learning.model';
import { FlashcardSetModel } from '../models/flashcard.model';
import { QuizSetModel } from '../models/quiz.model';
import { QuizAttemptModel, StudyTaskModel } from '../models/workspace.model';
import { advancedLearningRepository } from '../repositories/advanced_learning.repository';
import { AuthContext, makeSafeId } from '../repositories/base.repository';
import { documentRepository } from '../repositories/document.repository';
import { flashcardRepository } from '../repositories/flashcard.repository';
import { quizRepository } from '../repositories/quiz.repository';
import { studyPlannerRepository } from '../repositories/study_planner.repository';
import { workspaceRepository } from '../repositories/workspace.repository';
import { geminiService } from './gemini.service';
import { ragService } from './rag.service';

export const ALLOWED_AUDIO_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/webm',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/ogg',
  'audio/flac',
  'audio/x-flac',
]);

export function resolveAudioMimeType(filename: string, providedMime?: string): string {
  const mime = (providedMime || '').toLowerCase().split(';')[0].trim();
  if (ALLOWED_AUDIO_MIME_TYPES.has(mime)) {
    if (mime === 'audio/mp3') return 'audio/mpeg';
    if (mime === 'audio/x-wav' || mime === 'audio/wave') return 'audio/wav';
    if (mime === 'audio/x-m4a' || mime === 'audio/m4a') return 'audio/mp4';
    if (mime === 'audio/x-flac') return 'audio/flac';
    return mime;
  }
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const extMap: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    webm: 'audio/webm',
    m4a: 'audio/mp4',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
  };
  return extMap[ext] || '';
}

export function validateAudioUploadFile(file?: Express.Multer.File): {
  mimeType: string;
  sizeBytes: number;
  filename: string;
} {
  if (!file || !file.buffer || file.buffer.length === 0) {
    throw new ApiError(400, 'Uploaded audio file is empty or missing.', 'EMPTY_AUDIO');
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new ApiError(413, 'Audio file exceeds the 15MB maximum upload limit.', 'FILE_TOO_LARGE');
  }
  const resolved = resolveAudioMimeType(file.originalname || '', file.mimetype);
  if (!resolved) {
    throw new ApiError(
      400,
      'Unsupported audio format. Supported formats: MP3, WAV, WebM, M4A, OGG, FLAC.',
      'UNSUPPORTED_AUDIO_FORMAT'
    );
  }
  return {
    mimeType: resolved,
    sizeBytes: file.size,
    filename: file.originalname || 'lecture-audio',
  };
}

export function deriveMasteryStatus(level: number): TopicMasteryModel['status'] {
  if (level >= 85) return 'mastered';
  if (level >= 65) return 'proficient';
  if (level >= 40) return 'learning';
  return 'struggling';
}

export function calculateStreakDays(sessions: StudySessionModel[], activityTimestamps: string[]): number {
  const daysSet = new Set<string>();
  for (const s of sessions) {
    if (s.startedAt && s.activeDurationSeconds > 0) {
      daysSet.add(s.startedAt.slice(0, 10));
    }
  }
  for (const ts of activityTimestamps) {
    if (ts) daysSet.add(ts.slice(0, 10));
  }
  if (daysSet.size === 0) return 0;

  const today = new Date();
  let streak = 0;
  for (let offset = 0; offset < 365; offset++) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - offset);
    const key = d.toISOString().slice(0, 10);
    if (daysSet.has(key)) {
      streak++;
    } else if (offset === 0) {
      // Allow streak up to yesterday if user hasn't studied yet today
      continue;
    } else {
      break;
    }
  }
  return streak;
}

export function computeLearningAnalyticsFromData(params: {
  range: '7d' | '30d' | '90d' | 'all';
  sessions: StudySessionModel[];
  quizAttempts: QuizAttemptModel[];
  quizSets: QuizSetModel[];
  flashcardSets: FlashcardSetModel[];
  topicMasteries: TopicMasteryModel[];
  tasks: StudyTaskModel[];
  activityTimestamps: string[];
}) {
  const { range, sessions, quizAttempts, quizSets, flashcardSets, topicMasteries, tasks, activityTimestamps } =
    params;

  const nowMs = Date.now();
  const rangeDays = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : null;
  const cutoffMs = rangeDays ? nowMs - rangeDays * 86_400_000 : 0;

  const inRange = (iso?: string) => {
    if (!iso) return false;
    if (!rangeDays) return true;
    const ms = new Date(iso).getTime();
    return Number.isFinite(ms) && ms >= cutoffMs;
  };

  const filteredSessions = sessions.filter((s) => inRange(s.startedAt));
  const filteredAttempts = quizAttempts.filter((a) => inRange(a.completedAt));

  // Daily study hours
  const dailyMap = new Map<string, { date: string; minutes: number; sessionsCount: number }>();
  if (rangeDays && rangeDays <= 30) {
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(nowMs - i * 86_400_000);
      const key = d.toISOString().slice(0, 10);
      dailyMap.set(key, { date: key, minutes: 0, sessionsCount: 0 });
    }
  }

  let totalActiveSeconds = 0;
  const subjectSecondsMap = new Map<string, number>();

  for (const s of filteredSessions) {
    const secs = Math.max(0, Number(s.activeDurationSeconds) || 0);
    totalActiveSeconds += secs;
    const dayKey = (s.startedAt || '').slice(0, 10);
    if (dayKey) {
      const cur = dailyMap.get(dayKey) || { date: dayKey, minutes: 0, sessionsCount: 0 };
      cur.minutes += Math.round((secs / 60) * 10) / 10;
      cur.sessionsCount += 1;
      dailyMap.set(dayKey, cur);
    }
    const subj = (s.subject || 'General Study').trim() || 'General Study';
    subjectSecondsMap.set(subj, (subjectSecondsMap.get(subj) || 0) + secs);
  }

  const dailyStudy = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Weekly totals (last 4 weeks)
  const weeklyMap = new Map<string, { weekStart: string; hours: number; sessionsCount: number }>();
  for (const s of filteredSessions) {
    const d = new Date(s.startedAt);
    if (Number.isNaN(d.getTime())) continue;
    const day = d.getUTCDay();
    const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
    const weekKey = monday.toISOString().slice(0, 10);
    const cur = weeklyMap.get(weekKey) || { weekStart: weekKey, hours: 0, sessionsCount: 0 };
    cur.hours = Math.round((cur.hours + (s.activeDurationSeconds || 0) / 3600) * 100) / 100;
    cur.sessionsCount += 1;
    weeklyMap.set(weekKey, cur);
  }
  const weeklyTotals = Array.from(weeklyMap.values()).sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  // Subject-wise quiz scores
  const quizSetMap = new Map(quizSets.map((q) => [q.id, q]));
  const subjectScoresMap = new Map<string, { totalScore: number; attempts: number }>();

  const quizTrend = [...filteredAttempts]
    .sort((a, b) => (a.completedAt || '').localeCompare(b.completedAt || ''))
    .map((a) => {
      const pct =
        typeof a.scorePercent === 'number'
          ? a.scorePercent
          : a.totalQuestions > 0
          ? Math.round((a.correctCount / a.totalQuestions) * 100)
          : a.score;
      const quizObj = quizSetMap.get(a.quizSetId);
      const subj = a.quizTitle || quizObj?.title || 'Quiz';
      const cur = subjectScoresMap.get(subj) || { totalScore: 0, attempts: 0 };
      cur.totalScore += pct;
      cur.attempts += 1;
      subjectScoresMap.set(subj, cur);

      return {
        attemptId: a.id,
        date: (a.completedAt || '').slice(0, 10),
        title: subj,
        scorePercent: pct,
      };
    });

  const subjectPerformance = Array.from(
    new Set([...subjectScoresMap.keys(), ...subjectSecondsMap.keys()])
  ).map((subject) => {
    const sc = subjectScoresMap.get(subject);
    const secs = subjectSecondsMap.get(subject) || 0;
    return {
      subject,
      avgQuizScore: sc && sc.attempts > 0 ? Math.round(sc.totalScore / sc.attempts) : null,
      quizAttempts: sc?.attempts || 0,
      studyMinutes: Math.round(secs / 60),
    };
  });

  // Flashcard mastery stats
  let totalCards = 0;
  let masteredCards = 0;
  let learningCards = 0;
  let unstudiedCards = 0;
  for (const deck of flashcardSets) {
    for (const c of deck.cards || []) {
      totalCards++;
      if (c.status === 'mastered') masteredCards++;
      else if (c.status === 'learning') learningCards++;
      else unstudiedCards++;
    }
  }

  // Topic mastery & weak areas
  const weakAreas = topicMasteries
    .filter((t) => t.masteryLevel < 70 || t.status === 'struggling')
    .sort((a, b) => a.masteryLevel - b.masteryLevel)
    .map((t) => ({
      id: t.id,
      subject: t.subject,
      topic: t.topic,
      masteryLevel: t.masteryLevel,
      status: t.status,
      difficultyLevel: t.difficultyLevel,
    }));

  // Revision completion rate (from tasks + due flashcards)
  const completedTasks = tasks.filter((t) => t.completed).length;
  const revisionCompletionRate =
    tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : null;

  const avgQuizScore =
    quizTrend.length > 0
      ? Math.round(quizTrend.reduce((acc, q) => acc + q.scorePercent, 0) / quizTrend.length)
      : null;

  const streakDays = calculateStreakDays(sessions, activityTimestamps);

  return {
    range,
    summary: {
      totalStudyHours: Math.round((totalActiveSeconds / 3600) * 100) / 100,
      totalStudyMinutes: Math.round(totalActiveSeconds / 60),
      sessionsCount: filteredSessions.length,
      quizzesCompleted: filteredAttempts.length,
      avgQuizScore,
      totalCards,
      masteredCards,
      flashcardMasteryPercent: totalCards > 0 ? Math.round((masteredCards / totalCards) * 100) : null,
      topicsTracked: topicMasteries.length,
      revisionCompletionRate,
      streakDays,
    },
    dailyStudy,
    weeklyTotals,
    subjectPerformance,
    quizTrend,
    flashcardBreakdown: {
      totalCards,
      masteredCards,
      learningCards,
      unstudiedCards,
    },
    topicProgress: topicMasteries.map((t) => ({
      id: t.id,
      subject: t.subject,
      topic: t.topic,
      masteryLevel: t.masteryLevel,
      status: t.status,
      difficultyLevel: t.difficultyLevel,
      nextReviewDate: t.nextReviewDate,
    })),
    weakAreas,
  };
}

export function computeUnifiedRevisionSchedule(params: {
  flashcardSets: FlashcardSetModel[];
  topicMasteries: TopicMasteryModel[];
  quizAttempts: QuizAttemptModel[];
  quizSets: QuizSetModel[];
  tasks: StudyTaskModel[];
  nowIso?: string;
}) {
  const todayStr = (params.nowIso || new Date().toISOString()).slice(0, 10);

  interface RevisionItem {
    id: string;
    sourceType: 'flashcard_deck' | 'topic_mastery' | 'quiz_weakness' | 'study_task';
    sourceId: string;
    title: string;
    subject: string;
    dueDate: string;
    bucket: 'overdue' | 'due_today' | 'upcoming' | 'completed';
    difficulty: string;
    masteryPercent: number;
    details: string;
    reschedulable: boolean;
  }

  const items: RevisionItem[] = [];

  const classifyDate = (dateStr?: string, completed = false): RevisionItem['bucket'] => {
    if (completed) return 'completed';
    const d = (dateStr || todayStr).slice(0, 10);
    if (d < todayStr) return 'overdue';
    if (d === todayStr) return 'due_today';
    return 'upcoming';
  };

  // 1. Flashcard decks (SM-2 due cards summary per deck)
  for (const deck of params.flashcardSets) {
    const cards = deck.cards || [];
    if (cards.length === 0) continue;
    const dueDates = cards
      .filter((c) => c.status !== 'mastered')
      .map((c) => (c.nextReviewDate || todayStr).slice(0, 10))
      .sort();
    const earliestDue = dueDates[0] || todayStr;
    const masteredCount = cards.filter((c) => c.status === 'mastered').length;
    const masteryPercent = Math.round((masteredCount / cards.length) * 100);
    const allMastered = masteredCount === cards.length;
    const dueNowCount = cards.filter(
      (c) => c.status !== 'mastered' && (c.nextReviewDate || todayStr).slice(0, 10) <= todayStr
    ).length;

    items.push({
      id: `rev-deck-${deck.id}`,
      sourceType: 'flashcard_deck',
      sourceId: deck.id,
      title: deck.title,
      subject: deck.category || 'Flashcard Deck',
      dueDate: earliestDue,
      bucket: classifyDate(earliestDue, allMastered),
      difficulty: masteryPercent < 40 ? 'hard' : masteryPercent < 75 ? 'medium' : 'easy',
      masteryPercent,
      details: allMastered
        ? `All ${cards.length} cards mastered`
        : `${dueNowCount} due now / ${cards.length} total cards`,
      reschedulable: !allMastered,
    });
  }

  // 2. Topic mastery items
  for (const tm of params.topicMasteries) {
    const completed = tm.status === 'mastered' && tm.nextReviewDate.slice(0, 10) > todayStr;
    items.push({
      id: `rev-tm-${tm.id}`,
      sourceType: 'topic_mastery',
      sourceId: tm.id,
      title: tm.topic,
      subject: tm.subject,
      dueDate: tm.nextReviewDate.slice(0, 10),
      bucket: classifyDate(tm.nextReviewDate, completed),
      difficulty: tm.difficultyLevel,
      masteryPercent: tm.masteryLevel,
      details: `${tm.status} • ${tm.masteryLevel}% mastery`,
      reschedulable: true,
    });
  }

  // 3. Quiz weakness detection (real attempts scoring < 70%)
  const quizMap = new Map(params.quizSets.map((q) => [q.id, q]));
  const latestByQuiz = new Map<string, QuizAttemptModel>();
  for (const att of params.quizAttempts) {
    const existing = latestByQuiz.get(att.quizSetId);
    if (!existing || (att.completedAt || '') > (existing.completedAt || '')) {
      latestByQuiz.set(att.quizSetId, att);
    }
  }
  for (const [quizId, att] of latestByQuiz.entries()) {
    const pct =
      typeof att.scorePercent === 'number'
        ? att.scorePercent
        : att.totalQuestions > 0
        ? Math.round((att.correctCount / att.totalQuestions) * 100)
        : att.score;
    if (pct < 75) {
      const qset = quizMap.get(quizId);
      items.push({
        id: `rev-quiz-${quizId}`,
        sourceType: 'quiz_weakness',
        sourceId: quizId,
        title: `Retake: ${att.quizTitle || qset?.title || 'Practice Quiz'}`,
        subject: qset?.difficulty || 'Quiz Review',
        dueDate: todayStr,
        bucket: 'due_today',
        difficulty: pct < 50 ? 'hard' : 'medium',
        masteryPercent: pct,
        details: `Last score ${pct}% (${att.correctCount}/${att.totalQuestions}) — scheduled for reinforcement`,
        reschedulable: false,
      });
    }
  }

  // 4. Study tasks from Study Planner
  for (const task of params.tasks) {
    const due = (task.scheduledDate || todayStr).slice(0, 10);
    items.push({
      id: `rev-task-${task.id}`,
      sourceType: 'study_task',
      sourceId: task.id,
      title: task.title,
      subject: task.subject || 'Study Plan',
      dueDate: due,
      bucket: classifyDate(due, task.completed),
      difficulty: task.priority || 'medium',
      masteryPercent: task.completed ? 100 : 25,
      details: `${task.durationMinutes || 25} min • ${task.taskType || 'study'}`,
      reschedulable: !task.completed,
    });
  }

  return {
    today: todayStr,
    overdue: items.filter((i) => i.bucket === 'overdue'),
    dueToday: items.filter((i) => i.bucket === 'due_today'),
    upcoming: items.filter((i) => i.bucket === 'upcoming'),
    completed: items.filter((i) => i.bucket === 'completed'),
    counts: {
      overdue: items.filter((i) => i.bucket === 'overdue').length,
      dueToday: items.filter((i) => i.bucket === 'due_today').length,
      upcoming: items.filter((i) => i.bucket === 'upcoming').length,
      completed: items.filter((i) => i.bucket === 'completed').length,
    },
  };
}

export function computePersonalizedMetricsSnapshot(params: {
  quizAttempts: QuizAttemptModel[];
  quizSets: QuizSetModel[];
  flashcardSets: FlashcardSetModel[];
  topicMasteries: TopicMasteryModel[];
  sessions: StudySessionModel[];
  documentsCount: number;
  notesCount: number;
}) {
  const quizMap = new Map(params.quizSets.map((q) => [q.id, q]));
  const subjectStats = new Map<
    string,
    { scores: number[]; wrongQuestions: string[]; studyMinutes: number; masteryValues: number[] }
  >();

  const ensureSubject = (name: string) => {
    const key = name.trim() || 'General Studies';
    if (!subjectStats.has(key)) {
      subjectStats.set(key, { scores: [], wrongQuestions: [], studyMinutes: 0, masteryValues: [] });
    }
    return subjectStats.get(key)!;
  };

  for (const att of params.quizAttempts) {
    const qz = quizMap.get(att.quizSetId);
    const subj = att.quizTitle || qz?.title || 'Quiz Practice';
    const pct =
      typeof att.scorePercent === 'number'
        ? att.scorePercent
        : att.totalQuestions > 0
        ? Math.round((att.correctCount / att.totalQuestions) * 100)
        : att.score;
    const entry = ensureSubject(subj);
    entry.scores.push(pct);

    if (qz && att.answers) {
      for (const q of qz.questions) {
        const given = att.answers[q.id];
        if (given && given.trim().toLowerCase() !== q.correctAnswer.trim().toLowerCase()) {
          entry.wrongQuestions.push(q.question.slice(0, 120));
        }
      }
    }
  }

  for (const s of params.sessions) {
    const entry = ensureSubject(s.subject);
    entry.studyMinutes += Math.round((s.activeDurationSeconds || 0) / 60);
  }

  for (const tm of params.topicMasteries) {
    const entry = ensureSubject(tm.subject);
    entry.masteryValues.push(tm.masteryLevel);
  }

  const weakSubjects: Array<{ subject: string; avgScore: number | null; avgMastery: number | null; reason: string }> =
    [];
  const strongSubjects: Array<{ subject: string; avgScore: number | null; avgMastery: number | null }> = [];

  for (const [subject, stat] of subjectStats.entries()) {
    const avgScore = stat.scores.length
      ? Math.round(stat.scores.reduce((a, b) => a + b, 0) / stat.scores.length)
      : null;
    const avgMastery = stat.masteryValues.length
      ? Math.round(stat.masteryValues.reduce((a, b) => a + b, 0) / stat.masteryValues.length)
      : null;

    const signal = avgScore ?? avgMastery;
    if (signal !== null && signal < 70) {
      weakSubjects.push({
        subject,
        avgScore,
        avgMastery,
        reason:
          avgScore !== null
            ? `Average quiz score ${avgScore}% across ${stat.scores.length} attempt(s)`
            : `Topic mastery averaging ${avgMastery}%`,
      });
    } else if (signal !== null && signal >= 75) {
      strongSubjects.push({ subject, avgScore, avgMastery });
    }
  }

  const difficultConcepts = params.topicMasteries
    .filter((t) => t.status === 'struggling' || t.masteryLevel < 60)
    .map((t) => ({
      id: t.id,
      subject: t.subject,
      topic: t.topic,
      masteryLevel: t.masteryLevel,
      struggleNotes: t.struggleNotes,
    }));

  const frequentlyIncorrectAnswers = Array.from(subjectStats.entries())
    .flatMap(([subject, st]) => st.wrongQuestions.map((q) => ({ subject, question: q })))
    .slice(0, 12);

  const todayStr = new Date().toISOString().slice(0, 10);
  let dueCardsCount = 0;
  let totalCardsCount = 0;
  let masteredCardsCount = 0;
  for (const deck of params.flashcardSets) {
    for (const c of deck.cards || []) {
      totalCardsCount++;
      if (c.status === 'mastered') masteredCardsCount++;
      else if ((c.nextReviewDate || todayStr).slice(0, 10) <= todayStr) dueCardsCount++;
    }
  }

  const topicsRequiringRevision = params.topicMasteries
    .filter((t) => t.nextReviewDate.slice(0, 10) <= todayStr || t.masteryLevel < 70)
    .map((t) => ({
      id: t.id,
      subject: t.subject,
      topic: t.topic,
      masteryLevel: t.masteryLevel,
      nextReviewDate: t.nextReviewDate.slice(0, 10),
    }));

  return {
    hasHistory:
      params.quizAttempts.length > 0 ||
      totalCardsCount > 0 ||
      params.sessions.length > 0 ||
      params.topicMasteries.length > 0,
    totals: {
      documentsCount: params.documentsCount,
      notesCount: params.notesCount,
      quizAttemptsCount: params.quizAttempts.length,
      flashcardsTotal: totalCardsCount,
      flashcardsMastered: masteredCardsCount,
      flashcardsDueToday: dueCardsCount,
      studyMinutesTotal: params.sessions.reduce((a, s) => a + Math.round((s.activeDurationSeconds || 0) / 60), 0),
      topicsTracked: params.topicMasteries.length,
    },
    weakSubjects,
    strongSubjects,
    difficultConcepts,
    frequentlyIncorrectAnswers,
    topicsRequiringRevision,
  };
}

export class AdvancedLearningService {
  // 1. PERSONALIZED LEARNING ASSISTANT
  public async getPersonalizedInsights(auth: AuthContext, includeAiCoaching = false) {
    const [quizAttempts, quizSets, flashcardSets, topicMasteries, sessions, docs, notes] =
      await Promise.all([
        workspaceRepository.getQuizAttempts(auth),
        quizRepository.findAllQuizzes(auth),
        flashcardRepository.findAllSets(auth),
        advancedLearningRepository.getTopicMasteries(auth),
        advancedLearningRepository.getStudySessions(auth),
        documentRepository.findAll(auth),
        workspaceRepository.getNotes(auth),
      ]);

    const snapshot = computePersonalizedMetricsSnapshot({
      quizAttempts,
      quizSets,
      flashcardSets,
      topicMasteries,
      sessions,
      documentsCount: docs.length,
      notesCount: notes.length,
    });

    // Evidence-based rule recommendations (works immediately even offline/without AI call)
    const deterministicRecs: Array<{
      title: string;
      reason: string;
      actionLabel: string;
      targetTab: string;
      priority: 'high' | 'medium' | 'low';
    }> = [];

    if (!snapshot.hasHistory) {
      deterministicRecs.push({
        title: 'Start your learning baseline',
        reason:
          docs.length > 0
            ? `You have ${docs.length} uploaded document(s) ready. Take a quick quiz or generate flashcards to establish your real mastery profile.`
            : 'No quiz attempts, flashcards, or study sessions recorded yet. Upload lecture notes or start a study timer to track progress.',
        actionLabel: docs.length > 0 ? 'Take a Diagnostic Quiz' : 'Upload Study Material',
        targetTab: docs.length > 0 ? 'quizzes' : 'notebook',
        priority: 'high',
      });
    } else {
      if (snapshot.weakSubjects.length > 0) {
        const w = snapshot.weakSubjects[0];
        deterministicRecs.push({
          title: `Strengthen weak area: ${w.subject}`,
          reason: w.reason,
          actionLabel: 'Open Adaptive Tutor',
          targetTab: 'adaptive',
          priority: 'high',
        });
      }
      if (snapshot.totals.flashcardsDueToday > 0) {
        deterministicRecs.push({
          title: `Review ${snapshot.totals.flashcardsDueToday} due flashcard(s)`,
          reason: 'Spaced repetition cards are due today to prevent forgetting.',
          actionLabel: 'Review Due Cards',
          targetTab: 'flashcards',
          priority: 'high',
        });
      }
      if (snapshot.topicsRequiringRevision.length > 0) {
        deterministicRecs.push({
          title: `Revise ${snapshot.topicsRequiringRevision.length} tracked topic(s)`,
          reason: `${snapshot.topicsRequiringRevision.map((t) => t.topic).slice(0, 3).join(', ')} are due for revision.`,
          actionLabel: 'Open Revision Schedule',
          targetTab: 'adaptive',
          priority: 'medium',
        });
      }
    }

    let aiCoaching: { headlineInsight: string; recommendations: typeof deterministicRecs } | null = null;
    if (includeAiCoaching) {
      aiCoaching = await geminiService.generatePersonalizedCoaching({
        metricsSnapshot: snapshot,
        auth,
      });
    }

    return {
      ...snapshot,
      recommendations: aiCoaching?.recommendations?.length ? aiCoaching.recommendations : deterministicRecs,
      headlineInsight: aiCoaching?.headlineInsight || null,
    };
  }

  // 2. ADAPTIVE LEARNING SYSTEM & TOPIC MASTERY
  public async listTopicMasteries(auth: AuthContext) {
    return advancedLearningRepository.getTopicMasteries(auth);
  }

  public async runAdaptiveTutorStep(
    payload: {
      topicMasteryId?: string;
      notebookId?: string;
      subject: string;
      topic: string;
      stage?: number;
      studentResponse?: string;
      checkQuestionAsked?: string;
    },
    auth: AuthContext
  ) {
    const existingList = await advancedLearningRepository.getTopicMasteries(auth);
    let current = payload.topicMasteryId
      ? existingList.find((t) => t.id === payload.topicMasteryId)
      : existingList.find(
          (t) =>
            t.topic.toLowerCase() === payload.topic.trim().toLowerCase() &&
            t.subject.toLowerCase() === payload.subject.trim().toLowerCase()
        );

    const now = new Date().toISOString();
    if (!current) {
      current = await advancedLearningRepository.saveTopicMastery(
        {
          id: makeSafeId('tm'),
          userId: auth.userId,
          notebookId: payload.notebookId,
          subject: payload.subject.trim().slice(0, 190),
          topic: payload.topic.trim().slice(0, 240),
          masteryLevel: 30,
          difficultyLevel: 'foundational',
          status: 'struggling',
          attemptsCount: 0,
          correctCount: 0,
          lastReviewedAt: now,
          nextReviewDate: now.slice(0, 10),
          createdAt: now,
          updatedAt: now,
        },
        auth
      );
    }

    // Retrieve optional grounded context from user's docs
    const rag = await ragService
      .retrieveContext({
        query: `${payload.subject} ${payload.topic}`,
        auth,
        notebookId: payload.notebookId || current.notebookId,
        topK: 4,
        maxContextTokens: 2200,
      })
      .catch(() => ({ formattedContext: '', hasEvidence: false }));

    const stepResult = await geminiService.generateAdaptiveStep({
      subject: current.subject,
      topic: current.topic,
      currentMastery: current.masteryLevel,
      difficultyLevel: current.difficultyLevel,
      stage: payload.stage || 1,
      studentResponse: payload.studentResponse,
      checkQuestionAsked: payload.checkQuestionAsked,
      contextSnippet: rag.hasEvidence ? rag.formattedContext : undefined,
      auth,
    });

    const hasAnswer = Boolean(payload.studentResponse?.trim());
    const nextMastery = Math.min(
      100,
      Math.max(0, current.masteryLevel + (hasAnswer ? stepResult.recommendedMasteryDelta : 0))
    );
    const daysUntilNext = nextMastery >= 85 ? 7 : nextMastery >= 65 ? 3 : 1;
    const nextDate = new Date(Date.now() + daysUntilNext * 86_400_000).toISOString().slice(0, 10);

    const updatedMastery = await advancedLearningRepository.saveTopicMastery(
      {
        ...current,
        masteryLevel: nextMastery,
        difficultyLevel: stepResult.nextDifficulty,
        status: deriveMasteryStatus(nextMastery),
        attemptsCount: (current.attemptsCount || 0) + (hasAnswer ? 1 : 0),
        correctCount: (current.correctCount || 0) + (hasAnswer && stepResult.understood ? 1 : 0),
        lastReviewedAt: now,
        nextReviewDate: hasAnswer ? nextDate : current.nextReviewDate,
        struggleNotes: !stepResult.understood ? stepResult.misconceptionIdentified.slice(0, 900) : current.struggleNotes,
        updatedAt: now,
      },
      auth
    );

    if (hasAnswer) {
      await workspaceRepository
        .addActivityLog(
          {
            type: 'adaptive_tutor',
            title: `Adaptive Practice: ${updatedMastery.topic}`,
            details: `${updatedMastery.subject} • ${updatedMastery.difficultyLevel} (${updatedMastery.masteryLevel}%)`,
            score: `${updatedMastery.masteryLevel}%`,
          },
          auth
        )
        .catch(() => {});
    }

    return {
      topicMastery: updatedMastery,
      step: stepResult,
    };
  }

  public async rescheduleRevisionItem(
    payload: { sourceType: string; sourceId: string; newDate: string },
    auth: AuthContext
  ) {
    const cleanDate = payload.newDate.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
      throw new ApiError(400, 'Valid YYYY-MM-DD date is required.');
    }

    if (payload.sourceType === 'topic_mastery') {
      const tm = await advancedLearningRepository.getTopicMasteryById(payload.sourceId, auth);
      if (!tm) throw new ApiError(404, 'Topic mastery record not found.');
      const updated = await advancedLearningRepository.saveTopicMastery(
        { ...tm, nextReviewDate: cleanDate, updatedAt: new Date().toISOString() },
        auth
      );
      return { updated };
    }

    if (payload.sourceType === 'flashcard_deck') {
      const deck = await flashcardRepository.findSetById(payload.sourceId, auth);
      if (!deck) throw new ApiError(404, 'Flashcard deck not found.');
      const updatedCards = deck.cards.map((c) =>
        c.status === 'mastered' ? c : { ...c, nextReviewDate: cleanDate }
      );
      const updated = await flashcardRepository.saveSet({ ...deck, cards: updatedCards }, auth);
      return { updated };
    }

    if (payload.sourceType === 'study_task') {
      const tasks = await workspaceRepository.getTasks(auth);
      const task = tasks.find((t) => t.id === payload.sourceId);
      if (!task) throw new ApiError(404, 'Study task not found.');
      const updated = await workspaceRepository.saveTask({ ...task, scheduledDate: cleanDate }, auth);
      return { updated };
    }

    throw new ApiError(400, 'Item type cannot be rescheduled.');
  }

  // 3. SMART EXAM PREPARATION WORKSPACE
  public async listExamPrepGuides(auth: AuthContext, notebookId?: string) {
    return advancedLearningRepository.getExamPrepGuides(auth, notebookId);
  }

  public async generateExamPrepGuide(
    payload: {
      notebookId?: string;
      subject: string;
      examDate: string;
      syllabusText?: string;
      pastPaperNotes?: string;
      selectedDocumentIds?: string[];
    },
    auth: AuthContext
  ): Promise<ExamPrepGuideModel> {
    const resolvedNbId =
      payload.notebookId || (await workspaceRepository.ensureDefaultNotebook(auth)).id;

    const rag = await ragService.retrieveContext({
      query: `${payload.subject} syllabus concepts formulas theorems exam`,
      auth,
      notebookId: resolvedNbId,
      selectedDocumentIds: payload.selectedDocumentIds,
      topK: 14,
      maxContextTokens: 7000,
    });

    let sourcesContext = rag.formattedContext;
    const evidenceSources = Array.from(new Set(rag.citations.map((c) => c.documentTitle)));

    if (!sourcesContext) {
      const docs = await documentRepository.findAll(auth, resolvedNbId);
      const picked =
        payload.selectedDocumentIds && payload.selectedDocumentIds.length > 0
          ? docs.filter((d) => payload.selectedDocumentIds!.includes(d.id))
          : docs;
      if (picked.length > 0) {
        sourcesContext = picked
          .slice(0, 6)
          .map((d) => `[Source: "${d.title}"]\n${(d.summary || d.content || '').slice(0, 4000)}`)
          .join('\n\n');
        evidenceSources.push(...picked.map((d) => d.title));
      }
    }

    const generated = await geminiService.generateExamPrepGuide({
      subject: payload.subject,
      examDate: payload.examDate,
      syllabusText: payload.syllabusText || '',
      sourcesContext,
      pastPaperNotes: payload.pastPaperNotes || '',
      evidenceSources,
      auth,
    });

    const now = new Date().toISOString();
    const guide: ExamPrepGuideModel = {
      id: makeSafeId('examprep'),
      userId: auth.userId,
      notebookId: resolvedNbId,
      subject: payload.subject.trim().slice(0, 190),
      examDate: payload.examDate.slice(0, 32),
      syllabusSummary: generated.syllabusSummary,
      topicPlan: generated.topicPlan,
      importantConcepts: generated.importantConcepts,
      recurringThemes: generated.recurringThemes,
      likelyTopics: generated.likelyTopics,
      practiceQuestions: generated.practiceQuestions,
      formulaSheet: generated.formulaSheet,
      revisionChecklist: generated.revisionChecklist,
      mockExamQuestions: generated.mockExamQuestions,
      evidenceSources: Array.from(new Set(evidenceSources)),
      uncertaintyNotice: generated.uncertaintyNotice,
      createdAt: now,
      updatedAt: now,
    };

    const saved = await advancedLearningRepository.saveExamPrepGuide(guide, auth);

    await workspaceRepository
      .addActivityLog(
        {
          type: 'exam_prep',
          title: `Exam Prep Guide: ${saved.subject}`,
          details: `Target ${saved.examDate} • ${saved.evidenceSources?.length || 0} evidence source(s)`,
        },
        auth
      )
      .catch(() => {});

    return saved;
  }

  public async updateExamPrepChecklist(
    guideId: string,
    revisionChecklist: Array<{ id: string; item: string; completed: boolean }>,
    auth: AuthContext
  ) {
    const existing = await advancedLearningRepository.getExamPrepGuideById(guideId, auth);
    if (!existing) throw new ApiError(404, 'Exam prep guide not found.');
    return advancedLearningRepository.saveExamPrepGuide(
      { ...existing, revisionChecklist, updatedAt: new Date().toISOString() },
      auth
    );
  }

  // 4. CONCEPT MAPS & VISUAL LEARNING STUDIO
  public async listDiagrams(auth: AuthContext, notebookId?: string) {
    return advancedLearningRepository.getDiagrams(auth, notebookId);
  }

  public async generateInteractiveDiagram(
    payload: { notebookId?: string; topic: string; diagramType: string; selectedDocumentIds?: string[] },
    auth: AuthContext
  ): Promise<VisualDiagramModel> {
    const resolvedNbId =
      payload.notebookId || (await workspaceRepository.ensureDefaultNotebook(auth)).id;

    const rag = await ragService
      .retrieveContext({
        query: payload.topic,
        auth,
        notebookId: resolvedNbId,
        selectedDocumentIds: payload.selectedDocumentIds,
        topK: 6,
        maxContextTokens: 3500,
      })
      .catch(() => ({ formattedContext: '', hasEvidence: false }));

    const generated = await geminiService.generateInteractiveDiagram({
      topic: payload.topic,
      diagramType: payload.diagramType,
      sourceContent: rag.hasEvidence ? rag.formattedContext : undefined,
      auth,
    });

    const now = new Date().toISOString();
    const diagram: VisualDiagramModel = {
      id: makeSafeId('diag'),
      userId: auth.userId,
      notebookId: resolvedNbId,
      title: generated.title || payload.topic,
      diagramType: payload.diagramType || 'concept_map',
      description: generated.description,
      nodes: generated.nodes,
      edges: generated.edges,
      mermaidSyntax: generated.mermaidSyntax,
      createdAt: now,
      updatedAt: now,
    };

    const saved = await advancedLearningRepository.saveDiagram(diagram, auth);

    await workspaceRepository
      .addActivityLog(
        {
          type: 'diagram_created',
          title: `Visual Studio: ${saved.title}`,
          details: `${saved.diagramType} • ${saved.nodes.length} nodes`,
        },
        auth
      )
      .catch(() => {});

    return saved;
  }

  public async saveDiagram(diagram: Partial<VisualDiagramModel> & { title: string }, auth: AuthContext) {
    const resolvedNbId =
      diagram.notebookId || (await workspaceRepository.ensureDefaultNotebook(auth)).id;
    const existing = diagram.id
      ? await advancedLearningRepository.getDiagramById(diagram.id, auth)
      : null;
    const now = new Date().toISOString();

    const payload: VisualDiagramModel = {
      id: existing ? existing.id : makeSafeId('diag'),
      userId: auth.userId,
      notebookId: resolvedNbId,
      title: diagram.title.trim().slice(0, 290),
      diagramType: diagram.diagramType || existing?.diagramType || 'concept_map',
      description: diagram.description ?? existing?.description ?? '',
      nodes: Array.isArray(diagram.nodes) ? diagram.nodes : existing?.nodes || [],
      edges: Array.isArray(diagram.edges) ? diagram.edges : existing?.edges || [],
      mermaidSyntax: diagram.mermaidSyntax ?? existing?.mermaidSyntax ?? '',
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    return advancedLearningRepository.saveDiagram(payload, auth);
  }

  // 5. AUDIO LECTURE ASSISTANT
  public async listAudioLectures(auth: AuthContext, notebookId?: string) {
    return advancedLearningRepository.getAudioLectures(auth, notebookId);
  }

  public async processAudioLectureUpload(
    file: Express.Multer.File | undefined,
    payload: { title?: string; notebookId?: string; durationSeconds?: number },
    auth: AuthContext
  ): Promise<AudioLectureModel> {
    const validated = validateAudioUploadFile(file);
    const resolvedNbId =
      payload.notebookId || (await workspaceRepository.ensureDefaultNotebook(auth)).id;

    const audioBase64 = file!.buffer.toString('base64');
    const transcriptionPrompt = `Transcribe this educational lecture audio accurately with clear punctuation and approximate paragraph breaks. Include timestamps like [MM:SS] when natural topic shifts occur. Do not invent words not spoken.`;

    const transcriptResult = await aiManagerService.transcribeAudio(
      audioBase64,
      validated.mimeType,
      transcriptionPrompt,
      auth
    );

    const rawTranscript = (transcriptResult.text || '').trim();
    if (!rawTranscript) {
      throw new ApiError(
        422,
        'Audio transcription returned empty text. Check that the audio track contains audible speech.',
        'EMPTY_TRANSCRIPT'
      );
    }

    const title = (payload.title || validated.filename.replace(/\.[^.]+$/, '') || 'Audio Lecture').slice(
      0,
      290
    );

    const structured = await geminiService.structureAudioLectureTranscript({
      title,
      rawTranscript,
      auth,
    });

    const now = new Date().toISOString();
    const record: AudioLectureModel = {
      id: makeSafeId('audio'),
      userId: auth.userId,
      notebookId: resolvedNbId,
      title,
      originalFilename: validated.filename.slice(0, 290),
      mimeType: validated.mimeType,
      fileSizeBytes: validated.sizeBytes,
      durationSeconds:
        typeof payload.durationSeconds === 'number' && payload.durationSeconds >= 0
          ? payload.durationSeconds
          : undefined,
      transcriptText: rawTranscript,
      transcriptSegments: structured.transcriptSegments,
      speakerNotesAvailable: structured.speakerNotesAvailable,
      speakerNotesNotice: structured.speakerNotesNotice,
      summary: structured.summary,
      keyConcepts: structured.keyConcepts,
      flashcards: structured.flashcards,
      quizQuestions: structured.quizQuestions,
      revisionNotes: structured.revisionNotes,
      createdAt: now,
    };

    const saved = await advancedLearningRepository.saveAudioLecture(record, auth);

    await workspaceRepository
      .addActivityLog(
        {
          type: 'audio_lecture',
          title: `Audio Lecture Transcribed: ${saved.title}`,
          details: `${Math.round(validated.sizeBytes / 1024)} KB • ${saved.keyConcepts?.length || 0} concepts extracted`,
        },
        auth
      )
      .catch(() => {});

    return saved;
  }

  // 6. UNIFIED SMART REVISION SCHEDULE
  public async getUnifiedRevisionSchedule(auth: AuthContext) {
    const [flashcardSets, topicMasteries, quizAttempts, quizSets, tasks] = await Promise.all([
      flashcardRepository.findAllSets(auth),
      advancedLearningRepository.getTopicMasteries(auth),
      workspaceRepository.getQuizAttempts(auth),
      quizRepository.findAllQuizzes(auth),
      workspaceRepository.getTasks(auth),
    ]);

    return computeUnifiedRevisionSchedule({
      flashcardSets,
      topicMasteries,
      quizAttempts,
      quizSets,
      tasks,
    });
  }

  // 7. STUDY SESSION TRACKER
  public async listStudySessions(auth: AuthContext) {
    return advancedLearningRepository.getStudySessions(auth);
  }

  public async recordStudySession(
    payload: {
      notebookId?: string;
      subject: string;
      activityType?: StudySessionModel['activityType'];
      startedAt: string;
      endedAt: string;
      activeDurationSeconds: number;
      pausedSeconds?: number;
      notes?: string;
    },
    auth: AuthContext
  ) {
    const activeSeconds = Math.max(0, Math.round(payload.activeDurationSeconds));
    const pausedSeconds = Math.max(0, Math.round(payload.pausedSeconds || 0));
    if (activeSeconds === 0) {
      throw new ApiError(400, 'Study session active duration must be greater than 0 seconds.');
    }

    const now = new Date().toISOString();
    const session: StudySessionModel = {
      id: makeSafeId('sess'),
      userId: auth.userId,
      notebookId: payload.notebookId,
      subject: (payload.subject || 'General Study').trim().slice(0, 190),
      activityType: payload.activityType || 'general',
      startedAt: payload.startedAt || now,
      endedAt: payload.endedAt || now,
      activeDurationSeconds: activeSeconds,
      pausedSeconds,
      notes: payload.notes?.slice(0, 950),
      createdAt: now,
    };

    const saved = await advancedLearningRepository.saveStudySession(session, auth);

    // Update user profile cumulative study minutes & streak
    try {
      const [profile, allSessions, activityLogs] = await Promise.all([
        workspaceRepository.ensureUserProfile(auth),
        advancedLearningRepository.getStudySessions(auth),
        workspaceRepository.getActivityLogs(auth),
      ]);
      const addMinutes = Math.max(1, Math.round(activeSeconds / 60));
      const newStreak = calculateStreakDays(
        allSessions,
        activityLogs.map((l) => l.createdAt)
      );
      await workspaceRepository.updateUserProfile(auth, {
        timeSpentMinutes: (profile.timeSpentMinutes || 0) + addMinutes,
        streakDays: Math.max(1, newStreak),
      });
    } catch {
      // Non-fatal
    }

    await workspaceRepository
      .addActivityLog(
        {
          type: 'study_session',
          title: `Study Session: ${saved.subject}`,
          details: `${Math.round(activeSeconds / 60)}m active (${Math.round(pausedSeconds / 60)}m paused excluded)`,
        },
        auth
      )
      .catch(() => {});

    return saved;
  }

  // 8. LEARNING ANALYTICS
  public async getLearningAnalytics(auth: AuthContext, range: '7d' | '30d' | '90d' | 'all' = '30d') {
    const [sessions, quizAttempts, quizSets, flashcardSets, topicMasteries, tasks, activityLogs] =
      await Promise.all([
        advancedLearningRepository.getStudySessions(auth),
        workspaceRepository.getQuizAttempts(auth),
        quizRepository.findAllQuizzes(auth),
        flashcardRepository.findAllSets(auth),
        advancedLearningRepository.getTopicMasteries(auth),
        workspaceRepository.getTasks(auth),
        workspaceRepository.getActivityLogs(auth),
      ]);

    return computeLearningAnalyticsFromData({
      range,
      sessions,
      quizAttempts,
      quizSets,
      flashcardSets,
      topicMasteries,
      tasks,
      activityTimestamps: activityLogs.map((l) => l.createdAt),
    });
  }
}

export const advancedLearningService = new AdvancedLearningService();
