import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import {
  calculateStreakDays,
  computeLearningAnalyticsFromData,
  computePersonalizedMetricsSnapshot,
  computeUnifiedRevisionSchedule,
  deriveMasteryStatus,
} from '../server/services/advanced_learning.service';
import { chunkingService } from '../server/services/chunking.service';
import {
  buildDocxBlob,
  escapeCsvCell,
  escapeHtml,
  parseFlashcardsImport,
  parseNotesImport,
} from '../src/utils/exportImport';
import { sanitizeSvg } from '../src/utils/sanitizeSvg';

describe('Adaptive Mastery, Analytics & Unified Revision Unit Logic', () => {
  it('derives accurate topic mastery status thresholds', () => {
    expect(deriveMasteryStatus(25)).toBe('struggling');
    expect(deriveMasteryStatus(39)).toBe('struggling');
    expect(deriveMasteryStatus(40)).toBe('learning');
    expect(deriveMasteryStatus(65)).toBe('proficient');
    expect(deriveMasteryStatus(85)).toBe('mastered');
    expect(deriveMasteryStatus(100)).toBe('mastered');
  });

  it('calculates study streaks across consecutive UTC days', () => {
    const today = new Date();
    const day0 = today.toISOString();
    const d1 = new Date(today);
    d1.setUTCDate(today.getUTCDate() - 1);
    const d2 = new Date(today);
    d2.setUTCDate(today.getUTCDate() - 2);
    const d5 = new Date(today);
    d5.setUTCDate(today.getUTCDate() - 5);

    const streak = calculateStreakDays(
      [
        {
          id: 's1',
          userId: 'u1',
          subject: 'Biology',
          startedAt: day0,
          endedAt: day0,
          activeDurationSeconds: 1200,
          pausedSeconds: 0,
          createdAt: day0,
        },
        {
          id: 's2',
          userId: 'u1',
          subject: 'Chemistry',
          startedAt: d1.toISOString(),
          endedAt: d1.toISOString(),
          activeDurationSeconds: 900,
          pausedSeconds: 60,
          createdAt: d1.toISOString(),
        },
      ],
      [d2.toISOString(), d5.toISOString()]
    );

    expect(streak).toBe(3);
  });

  it('computes active-only analytics metrics and date range filtering accurately', () => {
    const now = new Date();
    const recentIso = new Date(now.getTime() - 2 * 86_400_000).toISOString();
    const oldIso = new Date(now.getTime() - 45 * 86_400_000).toISOString();

    const baseInput = {
      sessions: [
        {
          id: 'sess-recent',
          userId: 'u1',
          subject: 'Algorithms',
          startedAt: recentIso,
          endedAt: recentIso,
          activeDurationSeconds: 1800,
          pausedSeconds: 600,
          createdAt: recentIso,
        },
        {
          id: 'sess-old',
          userId: 'u1',
          subject: 'Databases',
          startedAt: oldIso,
          endedAt: oldIso,
          activeDurationSeconds: 3600,
          pausedSeconds: 0,
          createdAt: oldIso,
        },
      ],
      quizAttempts: [
        {
          id: 'qa1',
          userId: 'u1',
          quizSetId: 'q1',
          quizTitle: 'Algorithms Mid',
          score: 4,
          correctCount: 4,
          totalQuestions: 5,
          scorePercent: 80,
          completedAt: recentIso,
        },
        {
          id: 'qa2',
          userId: 'u1',
          quizSetId: 'q2',
          quizTitle: 'Databases Intro',
          score: 2,
          correctCount: 2,
          totalQuestions: 5,
          scorePercent: 40,
          completedAt: oldIso,
        },
      ],
      quizSets: [
        {
          id: 'q1',
          userId: 'u1',
          notebookId: 'nb1',
          title: 'Algorithms Mid',
          description: 'Sorting & graphs',
          difficulty: 'medium' as const,
          questions: [],
          createdAt: recentIso,
        },
        {
          id: 'q2',
          userId: 'u1',
          notebookId: 'nb1',
          title: 'Databases Intro',
          description: 'Normalization',
          difficulty: 'easy' as const,
          questions: [],
          createdAt: oldIso,
        },
      ],
      flashcardSets: [
        {
          id: 'fc1',
          userId: 'u1',
          notebookId: 'nb1',
          title: 'Trees',
          description: 'Tree structures',
          category: 'CS',
          createdAt: recentIso,
          cards: [
            {
              id: 'c1',
              question: 'AVL?',
              answer: 'Balanced BST',
              intervalDays: 6,
              easeFactor: 2.5,
              repetitions: 2,
              nextReviewDate: recentIso,
              status: 'mastered' as const,
            },
            {
              id: 'c2',
              question: 'Trie?',
              answer: 'Prefix tree',
              intervalDays: 1,
              easeFactor: 2.5,
              repetitions: 1,
              nextReviewDate: recentIso,
              status: 'learning' as const,
            },
          ],
        },
      ],
      topicMasteries: [
        {
          id: 'tm-db',
          userId: 'u1',
          subject: 'Databases',
          topic: 'Normalization (BCNF)',
          masteryLevel: 35,
          status: 'struggling' as const,
          difficultyLevel: 'foundational' as const,
          attemptsCount: 2,
          correctCount: 0,
          lastReviewedAt: oldIso,
          nextReviewDate: recentIso.slice(0, 10),
          createdAt: oldIso,
          updatedAt: oldIso,
        },
      ],
      tasks: [],
      activityTimestamps: [recentIso],
    };

    const sevenDay = computeLearningAnalyticsFromData({ ...baseInput, range: '7d' });
    expect(sevenDay.summary.totalStudyMinutes).toBe(30); // paused 600s excluded, old session excluded
    expect(sevenDay.summary.quizzesCompleted).toBe(1);
    expect(sevenDay.summary.avgQuizScore).toBe(80);
    expect(sevenDay.flashcardBreakdown).toEqual({
      totalCards: 2,
      masteredCards: 1,
      learningCards: 1,
      unstudiedCards: 0,
    });

    const allTime = computeLearningAnalyticsFromData({ ...baseInput, range: 'all' });
    expect(allTime.summary.totalStudyMinutes).toBe(90); // 1800s + 3600s = 5400s = 90m
    expect(allTime.summary.quizzesCompleted).toBe(2);
    expect(allTime.summary.avgQuizScore).toBe(60);
    expect(allTime.subjectPerformance.find((s) => s.subject === 'Databases Intro')?.avgQuizScore).toBe(40);
    expect(allTime.weakAreas.some((w) => w.subject === 'Databases')).toBe(true);
  });

  it('builds unified revision schedule across flashcards, topics, quizzes, and study tasks', () => {
    const schedule = computeUnifiedRevisionSchedule({
      nowIso: '2026-11-26T10:00:00.000Z',
      flashcardSets: [
        {
          id: 'fc-due',
          userId: 'u1',
          notebookId: 'nb1',
          title: 'Organic Chemistry',
          description: 'Alkanes deck',
          category: 'Chemistry',
          createdAt: '2026-11-20T00:00:00.000Z',
          cards: [
            {
              id: 'c1',
              question: 'Alkane formula?',
              answer: 'CnH2n+2',
              intervalDays: 1,
              easeFactor: 2.5,
              repetitions: 0,
              nextReviewDate: '2026-11-24',
              status: 'learning',
            },
          ],
        },
      ],
      topicMasteries: [
        {
          id: 'tm-1',
          userId: 'u1',
          subject: 'Physics',
          topic: 'Gauss Law',
          masteryLevel: 45,
          status: 'learning',
          difficultyLevel: 'intermediate',
          attemptsCount: 2,
          correctCount: 1,
          lastReviewedAt: '2026-11-25T10:00:00.000Z',
          nextReviewDate: '2026-11-26',
          createdAt: '2026-11-20T10:00:00.000Z',
          updatedAt: '2026-11-25T10:00:00.000Z',
        },
      ],
      quizAttempts: [
        {
          id: 'qa-weak',
          userId: 'u1',
          quizSetId: 'q-weak',
          quizTitle: 'Thermodynamics Quiz',
          score: 50,
          correctCount: 2,
          totalQuestions: 4,
          scorePercent: 50,
          completedAt: '2026-11-25T12:00:00.000Z',
        },
      ],
      quizSets: [
        {
          id: 'q-weak',
          userId: 'u1',
          notebookId: 'nb1',
          title: 'Thermodynamics Quiz',
          description: 'Laws of thermodynamics',
          difficulty: 'hard',
          questions: [],
          createdAt: '2026-11-20T00:00:00.000Z',
        },
      ],
      tasks: [
        {
          id: 't-future',
          userId: 'u1',
          title: 'Review Linear Algebra',
          subject: 'Math',
          taskType: 'revision',
          scheduledDate: '2026-11-29',
          durationMinutes: 45,
          priority: 'high',
          completed: false,
          createdAt: '2026-11-25T00:00:00.000Z',
        },
      ],
    });

    expect(schedule.counts).toEqual({
      overdue: 1,
      dueToday: 2,
      upcoming: 1,
      completed: 0,
    });
    expect(schedule.overdue[0].title).toBe('Organic Chemistry');
    expect(schedule.upcoming[0].title).toBe('Review Linear Algebra');
  });

  it('derives personalized metrics snapshot from real evidence only', () => {
    const snapshot = computePersonalizedMetricsSnapshot({
      quizAttempts: [
        {
          id: 'a1',
          userId: 'u1',
          quizSetId: 'q1',
          quizTitle: 'OS Scheduling',
          score: 1,
          correctCount: 1,
          totalQuestions: 2,
          scorePercent: 50,
          answers: { q1_1: 'FIFO', q1_2: 'Round Robin' },
          completedAt: '2026-11-25T00:00:00.000Z',
        },
      ],
      quizSets: [
        {
          id: 'q1',
          userId: 'u1',
          notebookId: 'nb1',
          title: 'OS Scheduling',
          description: 'CPU schedulers',
          difficulty: 'medium',
          createdAt: '2026-11-20T00:00:00.000Z',
          questions: [
            {
              id: 'q1_1',
              type: 'multiple-choice',
              question: 'Which minimizes average wait time?',
              options: ['FIFO', 'SJF'],
              correctAnswer: 'SJF',
              explanation: 'Shortest job first is optimal for avg wait time.',
            },
            {
              id: 'q1_2',
              type: 'multiple-choice',
              question: 'Which uses time quantum?',
              options: ['Round Robin', 'LIFO'],
              correctAnswer: 'Round Robin',
              explanation: 'RR assigns fixed quantum.',
            },
          ],
        },
      ],
      flashcardSets: [],
      topicMasteries: [],
      sessions: [],
      documentsCount: 1,
      notesCount: 0,
    });

    expect(snapshot.weakSubjects.length).toBe(1);
    expect(snapshot.weakSubjects[0].subject).toBe('OS Scheduling');
    expect(snapshot.frequentlyIncorrectAnswers[0].question).toContain('minimizes average wait time');
  });
});

describe('Security Sanitization & Export/Import Integrity', () => {
  it('neutralizes CSV spreadsheet formula injection payloads', () => {
    expect(escapeCsvCell('=CMD("calc")')).toBe("'=CMD(\"\"calc\"\")".replace(/^'/, "'") ? `"'=CMD(""calc"")"` : '');
    const payload = escapeCsvCell('=HYPERLINK("http://evil.example","Click")');
    expect(payload.startsWith('"\'=')).toBe(true);
    expect(escapeCsvCell('+1+1')).toBe("'+1+1");
    expect(escapeCsvCell('-2+3')).toBe("'-2+3");
    expect(escapeCsvCell('@SUM(A1:A2)')).toBe("'@SUM(A1:A2)");
  });

  it('escapes HTML injection payloads for printable PDF rendering', () => {
    const escaped = escapeHtml('<script>alert("xss")</script>&"quote\'');
    expect(escaped).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;&amp;&quot;quote&#39;');
    expect(escaped).not.toContain('<script>');
  });

  it('strips executable tags, inline event handlers, and javascript URIs from SVG output', () => {
    const dirty =
      '<svg onload="alert(1)" xmlns="http://www.w3.org/2000/svg"><script>fetch("https://evil.test")</script><foreignObject><div>bad</div></foreignObject><a xlink:href="javascript:alert(2)"><rect width="10" height="10" onclick="evil()" /></a></svg>';
    const clean = sanitizeSvg(dirty);

    expect(clean.toLowerCase()).not.toContain('<script');
    expect(clean.toLowerCase()).not.toContain('foreignobject');
    expect(clean.toLowerCase()).not.toContain('onload=');
    expect(clean.toLowerCase()).not.toContain('onclick=');
    expect(clean.toLowerCase()).not.toContain('javascript:');
    expect(clean).toContain('xlink:href="#"');
  });

  it('builds a valid OpenXML .docx ZIP archive with document.xml', async () => {
    const blob = await buildDocxBlob('Exam Prep Sheet', [
      { heading: 'Key Formulas', body: 'E = mc^2 & F = ma < Newton >' },
    ]);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(zip.file('[Content_Types].xml')).not.toBeNull();
    expect(zip.file('_rels/.rels')).not.toBeNull();
    const docXml = await zip.file('word/document.xml')?.async('string');
    expect(docXml).toContain('Exam Prep Sheet');
    expect(docXml).toContain('E = mc^2 &amp; F = ma &lt; Newton &gt;');
  });

  it('parses imported flashcards (CSV, TSV, JSON) and Markdown notes safely', () => {
    const csvCards = parseFlashcardsImport(
      'biology.csv',
      'Question,Answer,Hint\n"What is ATP?","Cellular energy currency","Mitochondria"'
    );
    expect(csvCards).toEqual([
      { question: 'What is ATP?', answer: 'Cellular energy currency', hint: 'Mitochondria' },
    ]);

    const tsvCards = parseFlashcardsImport('anki.tsv', 'Mitosis\tCell division creating 2 identical nuclei');
    expect(tsvCards).toEqual([
      { question: 'Mitosis', answer: 'Cell division creating 2 identical nuclei', hint: undefined },
    ]);

    const jsonCards = parseFlashcardsImport(
      'deck.json',
      JSON.stringify({ cards: [{ front: 'DNA', back: 'Genetic blueprint' }] })
    );
    expect(jsonCards).toEqual([{ question: 'DNA', answer: 'Genetic blueprint', hint: undefined }]);

    const mdNotes = parseNotesImport('lecture1.md', '# Neural Networks\nBackpropagation updates weights.');
    expect(mdNotes).toEqual([
      { title: 'Neural Networks', content: 'Backpropagation updates weights.', tags: ['imported'] },
    ]);
  });

  it('chunks documents while preserving page, slide, and heading citations', () => {
    const chunks = chunkingService.buildChunks(
      [
        {
          pageNumber: 3,
          sectionHeading: 'Thermodynamics First Law',
          text: 'Internal energy change equals heat added minus work done by the system. '.repeat(60),
        },
      ],
      {
        documentId: 'doc-123',
        userId: 'u1',
        notebookId: 'nb1',
        sourceTitle: 'Physics Textbook',
        targetChars: 800,
        overlapChars: 120,
      }
    );

    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks[0].pageNumber).toBe(3);
    expect(chunks[0].sectionHeading).toBe('Thermodynamics First Law');
    expect(chunks[0].sourceTitle).toBe('Physics Textbook');
  });
});
