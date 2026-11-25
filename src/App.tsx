import React, { useState, useEffect } from 'react';
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

import {
  ActiveTab,
  Notebook,
  SourceDocument,
  NoteItem,
  FlashcardSet,
  QuizSet,
  ChatMessage,
  StudyStats,
  HistoryLogItem,
  UserProfile,
  AdminMetric,
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
  initialAdminMetrics,
} from './data/sampleData';

import { generateAIFlashcards, generateAIQuiz } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [showSplitScreen, setShowSplitScreen] = useState(false);

  // Load persistent state or fall back to sampleData
  const [notebooks, setNotebooks] = useState<Notebook[]>(() => {
    const saved = localStorage.getItem('study_notebooks');
    return saved ? JSON.parse(saved) : initialNotebooks;
  });

  const [activeNotebookId, setActiveNotebookId] = useState<string>(
    notebooks[0]?.id || 'nb-1'
  );

  const [sources, setSources] = useState<SourceDocument[]>(() => {
    const saved = localStorage.getItem('study_sources');
    return saved ? JSON.parse(saved) : initialSources;
  });

  const [notes, setNotes] = useState<NoteItem[]>(() => {
    const saved = localStorage.getItem('study_notes');
    return saved ? JSON.parse(saved) : initialNotes;
  });

  const [flashcardSets, setFlashcardSets] = useState<FlashcardSet[]>(() => {
    const saved = localStorage.getItem('study_flashcard_sets');
    return saved ? JSON.parse(saved) : initialFlashcardSets;
  });

  const [quizSets, setQuizSets] = useState<QuizSet[]>(() => {
    const saved = localStorage.getItem('study_quiz_sets');
    return saved ? JSON.parse(saved) : initialQuizSets;
  });

  const [stats, setStats] = useState<StudyStats>(() => {
    const saved = localStorage.getItem('study_stats');
    return saved ? JSON.parse(saved) : initialStats;
  });

  const [historyLogs, setHistoryLogs] = useState<HistoryLogItem[]>(() => {
    const saved = localStorage.getItem('study_history_logs');
    return saved ? JSON.parse(saved) : initialHistory;
  });

  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('study_user_profile');
    return saved ? JSON.parse(saved) : initialUserProfile;
  });

  const [adminMetrics, setAdminMetrics] = useState<AdminMetric>(initialAdminMetrics);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      sender: 'assistant',
      text: 'Hello! I am your AI Study Assistant. I can answer questions grounded in your uploaded documents, generate Quizlet flashcards, format Notion AI study notes, and guide you with Socratic tutoring.',
      timestamp: 'Just now',
      suggestedQuestions: [
        'Summarize my active study sources',
        'Create 3 high-yield exam practice questions',
        'Give me a simple analogy for Transformer Self-Attention',
      ],
    },
  ]);

  // Sync state to local storage
  useEffect(() => {
    localStorage.setItem('study_notebooks', JSON.stringify(notebooks));
  }, [notebooks]);

  useEffect(() => {
    localStorage.setItem('study_sources', JSON.stringify(sources));
  }, [sources]);

  useEffect(() => {
    localStorage.setItem('study_notes', JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem('study_flashcard_sets', JSON.stringify(flashcardSets));
  }, [flashcardSets]);

  useEffect(() => {
    localStorage.setItem('study_quiz_sets', JSON.stringify(quizSets));
  }, [quizSets]);

  useEffect(() => {
    localStorage.setItem('study_stats', JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    localStorage.setItem('study_history_logs', JSON.stringify(historyLogs));
  }, [historyLogs]);

  useEffect(() => {
    localStorage.setItem('study_user_profile', JSON.stringify(userProfile));
  }, [userProfile]);

  const activeNotebook = notebooks.find((nb) => nb.id === activeNotebookId);

  // Filter sources, notes, flashcards, and quizzes for current active notebook
  const currentSources = sources.filter((s) => s.notebookId === activeNotebookId);
  const currentNotes = notes.filter((n) => n.notebookId === activeNotebookId);
  const currentFlashcardSets = flashcardSets.filter((f) => f.notebookId === activeNotebookId);
  const currentQuizSets = quizSets.filter((q) => q.notebookId === activeNotebookId);

  // Handlers
  const handleOpenAuth = (mode: 'login' | 'register' = 'login') => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  const handleCreateNotebook = (title: string, description: string) => {
    const newNb: Notebook = {
      id: `nb-${Date.now()}`,
      title,
      description,
      color: 'from-purple-600 to-indigo-600',
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };
    setNotebooks((prev) => [...prev, newNb]);
    setActiveNotebookId(newNb.id);
  };

  const handleAddSource = (source: SourceDocument) => {
    setSources((prev) => [source, ...prev]);
    setHistoryLogs((prev) => [
      {
        id: `log-${Date.now()}`,
        type: 'source_added',
        title: source.title,
        details: `Indexed document into ${activeNotebook?.title || 'workspace'}`,
        timestamp: new Date().toLocaleString(),
      },
      ...prev,
    ]);
  };

  const handleDeleteSource = (id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSaveNote = (savedNote: NoteItem) => {
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

  const handleDeleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const handleAddFlashcardSet = (newSet: FlashcardSet) => {
    setFlashcardSets((prev) => [newSet, ...prev]);
  };

  const handleUpdateCardStatus = (
    setId: string,
    cardId: string,
    status: 'mastered' | 'learning'
  ) => {
    setFlashcardSets((prevSets) =>
      prevSets.map((set) => {
        if (set.id !== setId) return set;
        return {
          ...set,
          cards: set.cards.map((c) => (c.id === cardId ? { ...c, status } : c)),
        };
      })
    );

    if (status === 'mastered') {
      setStats((prev) => ({
        ...prev,
        cardsMastered: prev.cardsMastered + 1,
      }));
    }
  };

  const handleAddQuizSet = (newSet: QuizSet) => {
    setQuizSets((prev) => [newSet, ...prev]);
  };

  const handleCompleteQuiz = () => {
    setStats((prev) => ({
      ...prev,
      quizzesCompleted: prev.quizzesCompleted + 1,
    }));
  };

  // Cross-module conversions
  const handleGenerateFlashcardsFromNote = async (noteTitle: string, noteContent: string) => {
    try {
      const cards = await generateAIFlashcards(noteTitle, noteContent, 5);
      const newSet: FlashcardSet = {
        id: `fc-${Date.now()}`,
        notebookId: activeNotebookId,
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
        })),
      };

      handleAddFlashcardSet(newSet);
      setActiveTab('flashcards');
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateQuizFromNote = async (noteTitle: string, noteContent: string) => {
    try {
      const questions = await generateAIQuiz(noteTitle, noteContent, 4);
      const newQuiz: QuizSet = {
        id: `qz-${Date.now()}`,
        notebookId: activeNotebookId,
        title: `Quiz: ${noteTitle}`,
        description: `Practice test generated from note "${noteTitle}"`,
        createdAt: new Date().toISOString().split('T')[0],
        questions: questions.map((q, idx) => ({
          id: `q-${Date.now()}-${idx}`,
          type: (q.type as any) || 'multiple-choice',
          question: q.question || 'Question',
          options: q.options || ['Option A', 'Option B', 'Option C', 'Option D'],
          correctAnswer: q.correctAnswer || 'Option A',
          explanation: q.explanation || 'Detailed AI rationale.',
        })),
      };

      handleAddQuizSet(newQuiz);
      setActiveTab('quiz');
    } catch (err) {
      console.error(err);
    }
  };

  const handleQuickPromptChat = (prompt: string) => {
    setActiveTab('chat');
  };

  // Render Full Screen Landing Page when activeTab === 'landing'
  if (activeTab === 'landing') {
    return (
      <>
        <LandingPage
          onStartLearning={() => setActiveTab('dashboard')}
          onOpenAuth={handleOpenAuth}
        />
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          defaultMode={authMode}
          onSuccess={(u) => {
            setUserProfile((prev) => ({ ...prev, name: u.name, email: u.email }));
            setActiveTab('dashboard');
          }}
        />
      </>
    );
  }

  return (
    <ToastProvider>
      <div className="flex h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased overflow-hidden">
        {/* Sidebar Navigation */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          notebooks={notebooks}
          activeNotebookId={activeNotebookId}
          setActiveNotebookId={setActiveNotebookId}
          onCreateNotebook={handleCreateNotebook}
          stats={stats}
          onOpenAuth={() => handleOpenAuth('login')}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
          <Header
            notebook={activeNotebook}
            sourceCount={currentSources.length}
            noteCount={currentNotes.length}
            cardCount={currentFlashcardSets.reduce((acc, set) => acc + set.cards.length, 0)}
            onQuickUpload={() => setActiveTab('notebooklm')}
            onQuickQuiz={() => setActiveTab('quiz')}
          />

          <BreadcrumbNav
            activeTab={activeTab}
            notebook={activeNotebook}
            onNavigate={(tab) => setActiveTab(tab)}
          />

          <main className="flex-1 pb-12">
            {activeTab === 'dashboard' && (
              <DashboardView
                setActiveTab={setActiveTab}
                activeNotebook={activeNotebook}
                sources={currentSources}
                notes={currentNotes}
                flashcardSets={currentFlashcardSets}
                quizSets={currentQuizSets}
                stats={stats}
                onQuickPromptChat={handleQuickPromptChat}
              />
            )}

            {activeTab === 'planner' && <StudyPlannerView />}

            {activeTab === 'notebooklm' && (
              <NotebookLMView
                sources={currentSources}
                onAddSource={handleAddSource}
                onDeleteSource={handleDeleteSource}
                onAskSource={(title) => {
                  setActiveTab('chat');
                }}
              />
            )}

            {activeTab === 'chat' && (
              <ChatView
                messages={chatMessages}
                setMessages={setChatMessages}
                sources={currentSources}
                notebookTitle={activeNotebook?.title || 'General Workspace'}
              />
            )}

            {activeTab === 'summary' && (
              <SummaryView sources={currentSources.length > 0 ? currentSources : sources} />
            )}

            {activeTab === 'notes' && (
              <NotesView
                notes={currentNotes}
                onSaveNote={handleSaveNote}
                onDeleteNote={handleDeleteNote}
                onGenerateFlashcardsFromNote={handleGenerateFlashcardsFromNote}
                onGenerateQuizFromNote={handleGenerateQuizFromNote}
              />
            )}

            {activeTab === 'flashcards' && (
              <FlashcardsView
                sets={currentFlashcardSets.length > 0 ? currentFlashcardSets : flashcardSets}
                onAddSet={handleAddFlashcardSet}
                onUpdateCardStatus={handleUpdateCardStatus}
              />
            )}

            {activeTab === 'quiz' && (
              <QuizView
                quizSets={currentQuizSets.length > 0 ? currentQuizSets : quizSets}
                onAddQuizSet={handleAddQuizSet}
                onCompleteQuiz={handleCompleteQuiz}
              />
            )}

            {activeTab === 'toolkit' && (
              <AiToolkitView sources={currentSources.length > 0 ? currentSources : sources} />
            )}

            {activeTab === 'history' && (
              <HistoryView
                historyLogs={historyLogs}
                onClearHistory={() => setHistoryLogs([])}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                profile={userProfile}
                onUpdateProfile={(updated) => setUserProfile(updated)}
              />
            )}

            {activeTab === 'admin' && <AdminPanel metrics={adminMetrics} />}
          </main>
        </div>

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          defaultMode={authMode}
          onSuccess={(u) => {
            setUserProfile((prev) => ({ ...prev, name: u.name, email: u.email }));
            setActiveTab('dashboard');
          }}
        />

        <PersistentAiPanel
          activeNotebookTitle={activeNotebook?.title}
          sourceContent={currentSources[0]?.content}
        />

        {showSplitScreen && (
          <SplitScreenView
            sources={currentSources.length > 0 ? currentSources : sources}
            activeNotebookTitle={activeNotebook?.title}
            onClose={() => setShowSplitScreen(false)}
          />
        )}

        <TextSelectionActionBar />
      </div>
    </ToastProvider>
  );
}

