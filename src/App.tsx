import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { NotebookLMView } from './components/NotebookLMView';
import { ChatView } from './components/ChatView';
import { NotesView } from './components/NotesView';
import { FlashcardsView } from './components/FlashcardsView';
import { QuizView } from './components/QuizView';
import { LandingPage } from './components/LandingPage';
import { AuthModal } from './components/AuthModal';
import { SummaryView } from './components/SummaryView';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';
import { AdminPanel } from './components/AdminPanel';
import { StudyPlannerView } from './components/StudyPlannerView';
import { AiToolkitView } from './components/AiToolkitView';
import { TextSelectionActionBar } from './components/TextSelectionActionBar';
import { ToastProvider } from './components/ToastContainer';
import { BreadcrumbNav } from './components/BreadcrumbNav';
import { PersistentAiPanel } from './components/PersistentAiPanel';
import { SplitScreenView } from './components/SplitScreenView';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { AnalyticsView } from './components/AnalyticsView';
import { ExamPrepView } from './components/ExamPrepView';
import { VisualLearningView } from './components/VisualLearningView';
import { AudioLectureView } from './components/AudioLectureView';
import { AdaptiveTutorView } from './components/AdaptiveTutorView';
import { OnboardingChecklistModal } from './components/OnboardingChecklistModal';

import {
  ActiveTab,
  Notebook,
  SourceDocument,
  NoteItem,
  FlashcardSet,
  QuizSet,
  QuizAttemptItem,
  ChatMessage,
  StudyStats,
  HistoryLogItem,
  UserProfile,
  AdminMetric,
  StudyTaskItem,
  NotificationItem,
  DocumentCitation,
} from './types';

import {
  initialNotebooks,
  initialSources,
  initialNotes,
  initialFlashcardSets,
  initialQuizSets,
  initialStats,
  initialHistory,
  initialUserProfile,
} from './data/sampleData';

import {
  fetchWorkspaceBootstrap,
  migrateLocalWorkspace,
  saveNotebookApi,
  deleteNotebookApi,
  deleteDocumentApi,
  saveNoteApi,
  deleteNoteApi,
  saveFlashcardSetApi,
  updateFlashcardSetApi,
  deleteFlashcardSetApi,
  saveQuizSetApi,
  submitQuizAttemptApi,
  saveTaskApi,
  deleteTaskApi,
  markNotificationReadApi,
  deleteNotificationApi,
  clearActivityLogsApi,
  updateSessionProfile,
  generateAIFlashcards,
  generateAIQuiz,
  updateUserPreferences,
} from './services/api';
import { useAuth } from './contexts/AuthContext';
import { Sparkles, UploadCloud, X } from 'lucide-react';

const EMPTY_PROFILE: UserProfile = {
  name: 'Student',
  email: '',
  avatar: '',
  role: 'Student',
  studyGoalMinutes: 60,
  preferredAIModel: 'gemini-4-hydrogen',
};

const EMPTY_STATS: StudyStats = {
  cardsMastered: 0,
  quizzesCompleted: 0,
  studyStreakDays: 0,
  timeSpentMinutes: 0,
  lastActive: 'Today',
};

export default function App() {
  const { user, loading: authLoading, isAuthenticated, isAdmin, signOut } = useAuth();

  const [activeTab, setActiveTab] = useState<ActiveTab>('landing');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [showSplitScreen, setShowSplitScreen] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [pendingChatPrompt, setPendingChatPrompt] = useState('');
  const [focusedCitation, setFocusedCitation] = useState<DocumentCitation | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [localMigrationAvailable, setLocalMigrationAvailable] = useState(false);
  const [migratingLocal, setMigratingLocal] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [languageConfigured, setLanguageConfigured] = useState(false);
  const [analyticsRefreshKey, setAnalyticsRefreshKey] = useState(0);

  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [activeNotebookId, setActiveNotebookId] = useState<string>('');
  const [sources, setSources] = useState<SourceDocument[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [flashcardSets, setFlashcardSets] = useState<FlashcardSet[]>([]);
  const [quizSets, setQuizSets] = useState<QuizSet[]>([]);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttemptItem[]>([]);
  const [studyPlans, setStudyPlans] = useState<any[]>([]);
  const [tasks, setTasks] = useState<StudyTaskItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [stats, setStats] = useState<StudyStats>(EMPTY_STATS);
  const [historyLogs, setHistoryLogs] = useState<HistoryLogItem[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [adminMetrics] = useState<AdminMetric>({
    totalUsers: 0,
    activeToday: 0,
    aiTokensUsed: 0,
    documentsIndexed: 0,
    systemHealth: 'Optimal',
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Check for legacy localStorage data available to migrate
  const checkLegacyLocalData = () => {
    try {
      const rawNb = localStorage.getItem('study_notebooks');
      const rawSrc = localStorage.getItem('study_sources');
      const rawNotes = localStorage.getItem('study_notes');
      if (rawNb || rawSrc || rawNotes) {
        setLocalMigrationAvailable(true);
      }
    } catch {
      // ignore
    }
  };

  const loadCloudWorkspace = useCallback(async () => {
    if (!user) return;
    setBootstrapping(true);
    try {
      const data = await fetchWorkspaceBootstrap();
      const loadedNotebooks: Notebook[] = data.notebooks || [];
      setNotebooks(loadedNotebooks);
      setActiveNotebookId((prev) =>
        loadedNotebooks.some((nb) => nb.id === prev) ? prev : loadedNotebooks[0]?.id || ''
      );
      setSources(data.documents || []);
      setNotes(data.notes || []);
      setFlashcardSets(data.flashcardSets || []);
      setQuizSets(data.quizSets || []);
      setQuizAttempts(data.quizAttempts || []);
      setStudyPlans(data.studyPlans || []);
      setTasks(data.tasks || []);
      setNotifications(data.notifications || []);
      setHistoryLogs(data.activityLogs || []);

      if (data.user) {
        setUserProfile({
          uid: data.user.uid,
          name: data.user.name || user.displayName || 'Student',
          email: data.user.email || user.email || '',
          avatar: data.user.avatar || user.photoURL || '',
          role: data.user.role || (isAdmin ? 'Admin' : 'Student'),
          studyGoalMinutes: data.user.studyGoalMinutes ?? 60,
          preferredAIModel:
            data.preferences?.aiModelPreference ||
            data.preferences?.aiModel ||
            'gemini-4-hydrogen',
        });
        setStats({
          cardsMastered: data.user.cardsMastered ?? 0,
          quizzesCompleted: data.user.quizzesCompleted ?? 0,
          studyStreakDays: data.user.streakDays ?? 0,
          timeSpentMinutes: data.user.timeSpentMinutes ?? 0,
          lastActive: data.user.lastActiveAt || 'Today',
        });
        setLanguageConfigured(
          Boolean(data.preferences?.language && data.preferences.language !== 'English')
        );
        if (
          data.preferences &&
          !data.preferences.onboardingDismissed &&
          (data.documents?.length || 0) === 0 &&
          (data.quizAttempts?.length || 0) === 0
        ) {
          setShowOnboarding(true);
        }
      }

      checkLegacyLocalData();
    } catch (err) {
      console.error('Workspace bootstrap failed:', err);
    } finally {
      setBootstrapping(false);
    }
  }, [user, isAdmin]);

  // React to Firebase auth transitions
  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated && user) {
      setIsDemoMode(false);
      setActiveTab((prev) => (prev === 'landing' ? 'dashboard' : prev));
      loadCloudWorkspace();
    } else if (!isDemoMode) {
      // Clear private cloud state on sign-out unless explicitly in Demo Mode
      setNotebooks([]);
      setActiveNotebookId('');
      setSources([]);
      setNotes([]);
      setFlashcardSets([]);
      setQuizSets([]);
      setQuizAttempts([]);
      setStudyPlans([]);
      setTasks([]);
      setNotifications([]);
      setHistoryLogs([]);
      setStats(EMPTY_STATS);
      setUserProfile(EMPTY_PROFILE);
      setLocalMigrationAvailable(false);
    }
  }, [authLoading, isAuthenticated, user, isDemoMode, loadCloudWorkspace]);

  // Cmd/Ctrl+K shortcut for Global Search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowGlobalSearch((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const enterDemoMode = () => {
    setIsDemoMode(true);
    setNotebooks(initialNotebooks);
    setActiveNotebookId(initialNotebooks[0]?.id || 'nb-1');
    setSources(initialSources);
    setNotes(initialNotes);
    setFlashcardSets(initialFlashcardSets);
    setQuizSets(initialQuizSets);
    setStats(initialStats);
    setHistoryLogs(initialHistory);
    setUserProfile({ ...initialUserProfile, name: 'Demo Student', email: 'demo@studylms.local' });
    setActiveTab('dashboard');
  };

  const handleImportLocalWorkspace = async () => {
    setMigratingLocal(true);
    try {
      const payload = {
        notebooks: JSON.parse(localStorage.getItem('study_notebooks') || '[]'),
        sources: JSON.parse(localStorage.getItem('study_sources') || '[]'),
        notes: JSON.parse(localStorage.getItem('study_notes') || '[]'),
        flashcardSets: JSON.parse(localStorage.getItem('study_flashcard_sets') || '[]'),
        quizSets: JSON.parse(localStorage.getItem('study_quiz_sets') || '[]'),
      };
      await migrateLocalWorkspace(payload);
      [
        'study_notebooks',
        'study_sources',
        'study_notes',
        'study_flashcard_sets',
        'study_quiz_sets',
        'study_stats',
        'study_history_logs',
        'study_user_profile',
      ].forEach((k) => localStorage.removeItem(k));
      setLocalMigrationAvailable(false);
      await loadCloudWorkspace();
    } catch (err) {
      console.error('Migration error:', err);
    } finally {
      setMigratingLocal(false);
    }
  };

  const activeNotebook = notebooks.find((nb) => nb.id === activeNotebookId) || notebooks[0];
  const resolvedNotebookId = activeNotebook?.id || activeNotebookId || 'nb-1';

  const currentSources = sources.filter((s) => s.notebookId === resolvedNotebookId);
  const currentNotes = notes.filter((n) => n.notebookId === resolvedNotebookId);
  const currentFlashcardSets = flashcardSets.filter((f) => f.notebookId === resolvedNotebookId);
  const currentQuizSets = quizSets.filter((q) => q.notebookId === resolvedNotebookId);

  const handleOpenAuth = (mode: 'login' | 'register' = 'login') => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  const handleSignOut = async () => {
    await signOut();
    setIsDemoMode(false);
    setActiveTab('landing');
  };

  const handleCreateNotebook = async (
    title: string,
    description: string,
    color = 'from-indigo-600 to-purple-600'
  ) => {
    const draft: Notebook = {
      id: `nb-${Date.now()}`,
      title,
      description,
      color,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };
    if (isAuthenticated) {
      try {
        const saved = await saveNotebookApi(draft);
        setNotebooks((prev) => [...prev, saved]);
        setActiveNotebookId(saved.id);
        return;
      } catch (err) {
        console.error(err);
      }
    }
    setNotebooks((prev) => [...prev, draft]);
    setActiveNotebookId(draft.id);
  };

  const handleUpdateNotebook = async (updated: Notebook) => {
    const withTimestamp = {
      ...updated,
      updatedAt: new Date().toISOString().split('T')[0],
    };
    setNotebooks((prev) => prev.map((nb) => (nb.id === updated.id ? withTimestamp : nb)));
    if (isAuthenticated) {
      await saveNotebookApi(withTimestamp).catch((err) => console.error(err));
    }
  };

  const handleDeleteNotebook = async (id: string, cascade = false) => {
    if (notebooks.length <= 1) return;
    if (isAuthenticated) {
      await deleteNotebookApi(id, cascade).catch((err) => console.error(err));
    }
    const fallbackNb = notebooks.find((nb) => nb.id !== id);
    setNotebooks((prev) => {
      const remaining = prev.filter((nb) => nb.id !== id);
      if (activeNotebookId === id && remaining[0]) {
        setActiveNotebookId(remaining[0].id);
      }
      return remaining;
    });

    if (cascade) {
      setSources((prev) => prev.filter((s) => s.notebookId !== id));
      setNotes((prev) => prev.filter((n) => n.notebookId !== id));
      setFlashcardSets((prev) => prev.filter((f) => f.notebookId !== id));
      setQuizSets((prev) => prev.filter((q) => q.notebookId !== id));
    } else if (fallbackNb) {
      setSources((prev) => prev.map((s) => (s.notebookId === id ? { ...s, notebookId: fallbackNb.id } : s)));
      setNotes((prev) => prev.map((n) => (n.notebookId === id ? { ...n, notebookId: fallbackNb.id } : n)));
      setFlashcardSets((prev) => prev.map((f) => (f.notebookId === id ? { ...f, notebookId: fallbackNb.id } : f)));
      setQuizSets((prev) => prev.map((q) => (q.notebookId === id ? { ...q, notebookId: fallbackNb.id } : q)));
    }
  };

  const handleAddSource = (source: SourceDocument) => {
    setSources((prev) => [source, ...prev]);
    setHistoryLogs((prev) => [
      {
        id: `log-${Date.now()}`,
        type: 'source_added',
        title: source.title,
        details: `Indexed document into ${activeNotebook?.title || 'workspace'}`,
        timestamp: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const handleUpdateSource = (updated: SourceDocument) => {
    setSources((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const handleDeleteSource = async (id: string) => {
    if (isAuthenticated) {
      await deleteDocumentApi(id).catch((err) => console.error(err));
    }
    setSources((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSaveNote = async (savedNote: NoteItem, saveVersion = false) => {
    if (isAuthenticated) {
      const persisted = await saveNoteApi({ ...savedNote, saveVersion });
      setNotes((prev) => {
        const idx = prev.findIndex((n) => n.id === persisted.id);
        if (idx !== -1) {
          const copy = [...prev];
          copy[idx] = persisted;
          return copy;
        }
        return [persisted, ...prev];
      });
      return;
    }
    setNotes((prev) => {
      const idx = prev.findIndex((n) => n.id === savedNote.id);
      if (idx !== -1) {
        const copy = [...prev];
        copy[idx] = savedNote;
        return copy;
      }
      return [savedNote, ...prev];
    });
  };

  const handleDeleteNote = async (id: string) => {
    if (isAuthenticated) {
      await deleteNoteApi(id).catch((err) => console.error(err));
    }
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const handleAddFlashcardSet = async (newSet: FlashcardSet) => {
    if (isAuthenticated) {
      try {
        const persisted = await saveFlashcardSetApi(newSet);
        setFlashcardSets((prev) => [persisted, ...prev]);
        return;
      } catch (err) {
        console.error(err);
      }
    }
    setFlashcardSets((prev) => [newSet, ...prev]);
  };

  const handleUpdateFlashcardSet = async (updatedSet: FlashcardSet) => {
    setFlashcardSets((prev) => prev.map((s) => (s.id === updatedSet.id ? updatedSet : s)));
    if (isAuthenticated) {
      await updateFlashcardSetApi(updatedSet).catch((err) => console.error(err));
    }
  };

  const handleDeleteFlashcardSet = async (setId: string) => {
    setFlashcardSets((prev) => prev.filter((s) => s.id !== setId));
    if (isAuthenticated) {
      await deleteFlashcardSetApi(setId).catch((err) => console.error(err));
    }
  };

  const handleUpdateCardStatus = (
    setId: string,
    cardId: string,
    status: 'mastered' | 'learning'
  ) => {
    setFlashcardSets((prevSets) => {
      const updatedSets = prevSets.map((set) => {
        if (set.id !== setId) return set;
        return {
          ...set,
          cards: set.cards.map((c) => (c.id === cardId ? { ...c, status } : c)),
        };
      });

      const uniqueMastered = updatedSets.reduce(
        (acc, set) => acc + set.cards.filter((c) => c.status === 'mastered').length,
        0
      );

      setStats((prev) => {
        if (prev.cardsMastered === uniqueMastered) return prev;
        if (isAuthenticated) {
          updateSessionProfile({ cardsMastered: uniqueMastered }).catch(() => {});
        }
        return { ...prev, cardsMastered: uniqueMastered };
      });

      return updatedSets;
    });
  };

  const handleAddQuizSet = async (newSet: QuizSet) => {
    if (isAuthenticated) {
      try {
        const persisted = await saveQuizSetApi(newSet);
        setQuizSets((prev) => [persisted, ...prev]);
        return;
      } catch (err) {
        console.error(err);
      }
    }
    setQuizSets((prev) => [newSet, ...prev]);
  };

  const handleSubmitQuizAttempt = async (attempt: {
    quizSetId: string;
    quizTitle: string;
    score: number;
    scorePercent: number;
    totalQuestions: number;
    correctCount: number;
    timeTakenSeconds?: number;
    answers?: Record<string, string>;
  }) => {
    if (isAuthenticated) {
      try {
        const saved = await submitQuizAttemptApi(attempt);
        setQuizAttempts((prev) => [saved, ...prev]);
        return;
      } catch (err) {
        console.error(err);
      }
    }
    setQuizAttempts((prev) => [
      {
        id: `att-${Date.now()}`,
        quizSetId: attempt.quizSetId,
        quizTitle: attempt.quizTitle,
        score: attempt.score,
        scorePercent: attempt.scorePercent,
        totalQuestions: attempt.totalQuestions,
        correctCount: attempt.correctCount,
        timeTakenSeconds: attempt.timeTakenSeconds,
        completedAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const handleCompleteQuiz = () => {
    setStats((prev) => {
      const nextCount = prev.quizzesCompleted + 1;
      if (isAuthenticated) {
        updateSessionProfile({ quizzesCompleted: nextCount }).catch(() => {});
      }
      return { ...prev, quizzesCompleted: nextCount };
    });
  };

  const handleAddTask = async (title: string) => {
    if (isAuthenticated) {
      try {
        const saved = await saveTaskApi({ title, completed: false, priority: 'medium' });
        setTasks((prev) => [saved, ...prev]);
        return;
      } catch (err) {
        console.error(err);
      }
    }
    setTasks((prev) => [
      {
        id: `task-${Date.now()}`,
        title,
        completed: false,
        priority: 'medium',
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const handleToggleTask = async (id: string) => {
    const existing = tasks.find((t) => t.id === id);
    if (!existing) return;
    const toggled = { ...existing, completed: !existing.completed };
    setTasks((prev) => prev.map((t) => (t.id === id ? toggled : t)));
    if (isAuthenticated) {
      await saveTaskApi(toggled).catch((err) => console.error(err));
    }
  };

  const handleDeleteTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (isAuthenticated) {
      await deleteTaskApi(id).catch((err) => console.error(err));
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    if (isAuthenticated) {
      await markNotificationReadApi(id).catch(() => {});
    }
  };

  const handleDeleteNotification = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (isAuthenticated) {
      await deleteNotificationApi(id).catch(() => {});
    }
  };

  const handleClearHistory = async () => {
    setHistoryLogs([]);
    if (isAuthenticated) {
      await clearActivityLogsApi().catch(() => {});
    }
  };

  const handleGenerateFlashcardsFromNote = async (noteTitle: string, noteContent: string) => {
    try {
      const cards = await generateAIFlashcards(noteTitle, noteContent, 5, resolvedNotebookId);
      const newSet: FlashcardSet = {
        id: `fc-${Date.now()}`,
        notebookId: resolvedNotebookId,
        title: `Cards: ${noteTitle}`,
        description: `Auto-generated from note "${noteTitle}"`,
        category: 'Study Note',
        createdAt: new Date().toISOString().split('T')[0],
        cards: cards.map((c, idx) => ({
          id: `c-${Date.now()}-${idx}`,
          question: c.question || 'Question',
          answer: c.answer || 'Answer',
          hint: c.hint,
          status: 'unstudied',
          box: 1,
          easeFactor: 2.5,
        })),
      };

      await handleAddFlashcardSet(newSet);
      setActiveTab('flashcards');
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateQuizFromNote = async (noteTitle: string, noteContent: string) => {
    try {
      const questions = await generateAIQuiz(noteTitle, noteContent, 4, 'medium', resolvedNotebookId);
      const newQuiz: QuizSet = {
        id: `qz-${Date.now()}`,
        notebookId: resolvedNotebookId,
        title: `Quiz: ${noteTitle}`,
        description: `Practice test generated from note "${noteTitle}"`,
        createdAt: new Date().toISOString().split('T')[0],
        questions: questions.map((q, idx) => ({
          id: `q-${Date.now()}-${idx}`,
          type: (q.type as any) || 'multiple-choice',
          question: q.question || 'Question',
          options: Array.isArray(q.options) && q.options.length > 0 ? q.options : undefined,
          matchingPairs: Array.isArray(q.matchingPairs) && q.matchingPairs.length > 0 ? q.matchingPairs : undefined,
          correctAnswer: q.correctAnswer || '',
          explanation: q.explanation || 'Detailed AI rationale.',
        })),
      };

      await handleAddQuizSet(newQuiz);
      setActiveTab('quiz');
    } catch (err) {
      console.error(err);
    }
  };

  const handleQuickPromptChat = (prompt: string) => {
    setPendingChatPrompt(prompt);
    setActiveTab('chat');
  };

  const handleOpenCitation = (citation: DocumentCitation) => {
    setFocusedCitation(citation);
    setActiveTab('notebooklm');
  };

  const handleInsertTransformedText = async (transformedText: string) => {
    const targetNote = currentNotes[0];
    if (targetNote) {
      await handleSaveNote(
        {
          ...targetNote,
          content: `${targetNote.content}\n\n---\n${transformedText}`,
          updatedAt: new Date().toISOString(),
        },
        true
      );
    } else {
      await handleSaveNote(
        {
          id: `note-${Date.now()}`,
          notebookId: resolvedNotebookId,
          title: 'AI Transformed Excerpt',
          content: transformedText,
          updatedAt: new Date().toISOString(),
          tags: ['AI Excerpt'],
        },
        true
      );
    }
    setActiveTab('notes');
  };

  if (activeTab === 'landing') {
    return (
      <>
        <LandingPage
          onStartLearning={() => {
            if (isAuthenticated) setActiveTab('dashboard');
            else enterDemoMode();
          }}
          onOpenAuth={handleOpenAuth}
        />
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          defaultMode={authMode}
          onSuccess={() => setActiveTab('dashboard')}
          onEnterDemoMode={enterDemoMode}
        />
      </>
    );
  }

  return (
    <ToastProvider>
      <div className="flex h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          notebooks={notebooks}
          activeNotebookId={resolvedNotebookId}
          setActiveNotebookId={setActiveNotebookId}
          onCreateNotebook={handleCreateNotebook}
          onUpdateNotebook={handleUpdateNotebook}
          onDeleteNotebook={handleDeleteNotebook}
          sources={sources}
          notes={notes}
          stats={stats}
          userProfile={userProfile}
          isAuthenticated={isAuthenticated}
          isDemoMode={isDemoMode}
          isAdmin={isAdmin}
          onOpenAuth={() => handleOpenAuth('login')}
          onSignOut={handleSignOut}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />

        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
          <Header
            notebook={activeNotebook}
            sourceCount={currentSources.length}
            noteCount={currentNotes.length}
            cardCount={currentFlashcardSets.reduce((acc, set) => acc + set.cards.length, 0)}
            onQuickUpload={() => setActiveTab('notebooklm')}
            onQuickQuiz={() => setActiveTab('quiz')}
            onOpenSearch={() => setShowGlobalSearch(true)}
            onToggleSplitScreen={() => setShowSplitScreen(true)}
            onToggleMobileMenu={() => setMobileSidebarOpen((v) => !v)}
            onOpenChecklist={() => setShowOnboarding(true)}
            onOpenAuth={() => handleOpenAuth('login')}
            isAuthenticated={isAuthenticated}
            isDemoMode={isDemoMode}
            userName={userProfile.name}
            activeModel={userProfile.preferredAIModel}
            notifications={notifications}
            onMarkNotificationRead={handleMarkNotificationRead}
            onDeleteNotification={handleDeleteNotification}
            onStudySessionSaved={(sess) => {
              const addMins = Math.max(1, Math.round(sess.activeDurationSeconds / 60));
              setStats((prev) => ({
                ...prev,
                timeSpentMinutes: prev.timeSpentMinutes + addMins,
                studyStreakDays: Math.max(1, prev.studyStreakDays),
              }));
              setAnalyticsRefreshKey((k) => k + 1);
            }}
          />

          <BreadcrumbNav
            activeTab={activeTab}
            notebook={activeNotebook}
            onNavigate={(tab) => setActiveTab(tab)}
          />

          {!isAuthenticated && isDemoMode && (
            <div className="mx-6 mt-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>
                  You are previewing <strong>Demo Mode</strong>. Sign in with Google or Email to upload documents, run Gemini AI queries, and save your progress.
                </span>
              </div>
              <button
                onClick={() => handleOpenAuth('login')}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shrink-0"
              >
                Sign In
              </button>
            </div>
          )}

          {isAuthenticated && localMigrationAvailable && (
            <div className="mx-6 mt-3 p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                <UploadCloud className="w-4 h-4 shrink-0" />
                <span>
                  Found local browser study data from a previous session. Import it once into your private cloud workspace?
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleImportLocalWorkspace}
                  disabled={migratingLocal}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  {migratingLocal ? 'Importing...' : 'Import to Cloud'}
                </button>
                <button
                  onClick={() => setLocalMigrationAvailable(false)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <main className="flex-1 pb-12">
            {bootstrapping ? (
              <div className="p-12 text-center text-xs text-slate-400 space-y-2">
                <Sparkles className="w-6 h-6 animate-spin text-indigo-500 mx-auto" />
                <p>Loading your workspace...</p>
              </div>
            ) : (
              <>
                {activeTab === 'dashboard' && (
                  <DashboardView
                    setActiveTab={setActiveTab}
                    activeNotebook={activeNotebook}
                    notebooksCount={notebooks.length}
                    sources={currentSources}
                    notes={currentNotes}
                    flashcardSets={currentFlashcardSets}
                    quizSets={currentQuizSets}
                    quizAttempts={quizAttempts}
                    stats={stats}
                    dailyGoalMinutes={userProfile.studyGoalMinutes}
                    tasks={tasks}
                    onAddTask={handleAddTask}
                    onToggleTask={handleToggleTask}
                    onDeleteTask={handleDeleteTask}
                    studyPlans={studyPlans}
                    historyLogs={historyLogs}
                    onQuickPromptChat={handleQuickPromptChat}
                  />
                )}

                {activeTab === 'planner' && <StudyPlannerView />}

                {activeTab === 'notebooklm' && (
                  <NotebookLMView
                    sources={currentSources}
                    activeNotebookId={resolvedNotebookId}
                    onAddSource={handleAddSource}
                    onUpdateSource={handleUpdateSource}
                    onDeleteSource={handleDeleteSource}
                    onSaveNote={handleSaveNote}
                    onAskSource={(title) =>
                      handleQuickPromptChat(`Explain the key topics in "${title}" with citations.`)
                    }
                    focusedCitation={focusedCitation}
                    onClearFocusedCitation={() => setFocusedCitation(null)}
                    isAuthenticated={isAuthenticated}
                  />
                )}

                {activeTab === 'chat' && (
                  <ChatView
                    messages={chatMessages}
                    setMessages={setChatMessages}
                    sources={currentSources}
                    notebookId={resolvedNotebookId}
                    notebookTitle={activeNotebook?.title || 'Study Workspace'}
                    initialPrompt={pendingChatPrompt}
                    onConsumeInitialPrompt={() => setPendingChatPrompt('')}
                    onOpenCitation={handleOpenCitation}
                    isAuthenticated={isAuthenticated}
                  />
                )}

                {activeTab === 'summary' && (
                  <SummaryView
                    sources={currentSources.length > 0 ? currentSources : sources}
                    activeNotebookId={resolvedNotebookId}
                    onSaveNote={handleSaveNote}
                    onOpenCitation={handleOpenCitation}
                  />
                )}

                {activeTab === 'notes' && (
                  <NotesView
                    notes={currentNotes}
                    activeNotebookId={resolvedNotebookId}
                    onSaveNote={handleSaveNote}
                    onDeleteNote={handleDeleteNote}
                    onGenerateFlashcardsFromNote={handleGenerateFlashcardsFromNote}
                    onGenerateQuizFromNote={handleGenerateQuizFromNote}
                    isAuthenticated={isAuthenticated}
                  />
                )}

                {activeTab === 'flashcards' && (
                  <FlashcardsView
                    sets={currentFlashcardSets}
                    sources={currentSources}
                    notes={currentNotes}
                    activeNotebookId={resolvedNotebookId}
                    onAddSet={handleAddFlashcardSet}
                    onUpdateSet={handleUpdateFlashcardSet}
                    onDeleteSet={handleDeleteFlashcardSet}
                    onUpdateCardStatus={handleUpdateCardStatus}
                  />
                )}

                {activeTab === 'quiz' && (
                  <QuizView
                    quizSets={currentQuizSets}
                    quizAttempts={quizAttempts}
                    sources={currentSources}
                    notes={currentNotes}
                    activeNotebookId={resolvedNotebookId}
                    isAuthenticated={isAuthenticated}
                    onAddQuizSet={handleAddQuizSet}
                    onSubmitAttempt={handleSubmitQuizAttempt}
                    onCompleteQuiz={handleCompleteQuiz}
                  />
                )}

                {activeTab === 'toolkit' && (
                  <AiToolkitView
                    sources={currentSources.length > 0 ? currentSources : sources}
                    activeNotebookId={resolvedNotebookId}
                  />
                )}

                {activeTab === 'adaptive' && (
                  <AdaptiveTutorView
                    activeNotebookId={resolvedNotebookId}
                    onNavigate={(tab) => setActiveTab(tab)}
                  />
                )}

                {activeTab === 'examprep' && (
                  <ExamPrepView
                    sources={currentSources.length > 0 ? currentSources : sources}
                    activeNotebookId={resolvedNotebookId}
                  />
                )}

                {activeTab === 'visuals' && (
                  <VisualLearningView
                    sources={currentSources.length > 0 ? currentSources : sources}
                    activeNotebookId={resolvedNotebookId}
                  />
                )}

                {activeTab === 'audio' && (
                  <AudioLectureView
                    activeNotebookId={resolvedNotebookId}
                    onAddFlashcardSet={handleAddFlashcardSet}
                    onAddQuizSet={handleAddQuizSet}
                    onSaveNote={handleSaveNote}
                  />
                )}

                {activeTab === 'analytics' && (
                  <AnalyticsView
                    onNavigate={(tab) => setActiveTab(tab)}
                    refreshSignal={analyticsRefreshKey}
                  />
                )}

                {activeTab === 'history' && (
                  <HistoryView historyLogs={historyLogs} onClearHistory={handleClearHistory} />
                )}

                {activeTab === 'settings' && (
                  <SettingsView
                    profile={userProfile}
                    onUpdateProfile={(updated) => setUserProfile(updated)}
                    onAccountDeleted={() => {
                      setIsDemoMode(false);
                      setActiveTab('landing');
                    }}
                    onShowOnboarding={() => setShowOnboarding(true)}
                    isAuthenticated={isAuthenticated}
                  />
                )}

                {activeTab === 'admin' && (
                  <AdminPanel metrics={adminMetrics} isAdmin={isAdmin || userProfile.role === 'Admin'} />
                )}
              </>
            )}
          </main>
        </div>

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          defaultMode={authMode}
          onSuccess={() => setActiveTab('dashboard')}
          onEnterDemoMode={enterDemoMode}
        />

        <GlobalSearchModal
          isOpen={showGlobalSearch}
          onClose={() => setShowGlobalSearch(false)}
          notebooks={notebooks}
          sources={sources}
          notes={notes}
          flashcardSets={flashcardSets}
          quizSets={quizSets}
          isAuthenticated={isAuthenticated}
          onSelectNotebook={setActiveNotebookId}
          onOpenCitation={handleOpenCitation}
          onNavigate={(tab) => setActiveTab(tab)}
        />

        <PersistentAiPanel
          activeNotebookTitle={activeNotebook?.title}
          sourceContent={currentSources[0]?.content}
        />

        {showSplitScreen && (
          <SplitScreenView
            sources={currentSources.length > 0 ? currentSources : sources}
            activeNotebookId={resolvedNotebookId}
            activeNotebookTitle={activeNotebook?.title}
            onClose={() => setShowSplitScreen(false)}
          />
        )}

        <OnboardingChecklistModal
          isOpen={showOnboarding}
          state={{
            hasNotebook: notebooks.length > 0,
            hasDocument: sources.length > 0,
            hasChat: chatMessages.length > 0 || historyLogs.some((l) => l.type === 'chat_query'),
            hasNote: notes.length > 0,
            hasFlashcards: flashcardSets.length > 0,
            hasQuiz: quizAttempts.length > 0,
            hasStudySession: stats.timeSpentMinutes > 0 || historyLogs.some((l) => l.type === 'study_session'),
            hasLanguageConfigured: languageConfigured,
            hasAdvancedStudio: historyLogs.some((l) =>
              ['exam_prep', 'adaptive_tutor', 'audio_lecture', 'diagram_created'].includes(l.type)
            ),
          }}
          onClose={() => setShowOnboarding(false)}
          onDismissForever={async () => {
            setShowOnboarding(false);
            if (isAuthenticated) {
              await updateUserPreferences({ onboardingDismissed: true }).catch(() => {});
            }
          }}
          onNavigate={(tab) => setActiveTab(tab)}
        />

        <TextSelectionActionBar onInsertTransformedText={handleInsertTransformedText} />
      </div>
    </ToastProvider>
  );
}
