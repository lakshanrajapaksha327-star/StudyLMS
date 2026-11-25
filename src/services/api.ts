import { SourceDocument, ChatMessage, Flashcard, QuizQuestion } from '../types';

export async function uploadDocument(
  file: File | null,
  pastedText: string,
  title: string
): Promise<{ document: Partial<SourceDocument>; flashcards: Partial<Flashcard>[] }> {
  const formData = new FormData();
  if (file) {
    formData.append('file', file);
  }
  if (pastedText) {
    formData.append('pastedText', pastedText);
  }
  if (title) {
    formData.append('title', title);
  }

  const response = await fetch('/api/upload-document', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to upload and analyze document');
  }

  return response.json();
}

export async function sendStudyChat(
  messages: ChatMessage[],
  sources: SourceDocument[],
  notebookTitle: string,
  persona: string = 'Standard Tutor'
): Promise<{ text: string; suggestedQuestions: string[]; sourcesUsed: string[] }> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      sources,
      notebookTitle,
      persona,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to get study response');
  }

  return response.json();
}

export async function runNotionAIAction(
  action: string,
  noteContent: string,
  noteTitle: string
): Promise<string> {
  const response = await fetch('/api/notion-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, noteContent, noteTitle }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to run AI note action');
  }

  const data = await response.json();
  return data.result;
}

export async function generateAIFlashcards(
  topic: string,
  sourceContent: string,
  cardCount: number = 5
): Promise<Partial<Flashcard>[]> {
  const response = await fetch('/api/generate-flashcards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, sourceContent, cardCount }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to generate flashcards');
  }

  const data = await response.json();
  return data.cards;
}

export async function generateAIQuiz(
  topic: string,
  sourceContent: string,
  questionCount: number = 4
): Promise<Partial<QuizQuestion>[]> {
  const response = await fetch('/api/generate-quiz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, sourceContent, questionCount }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to generate quiz');
  }

  const data = await response.json();
  return data.questions;
}

export async function generateAIExplanation(
  concept: string,
  mode: string = 'socratic',
  context?: string
): Promise<{ concept: string; mode: string; explanation: string; keyTakeaways: string[]; suggestedFollowUps: string[] }> {
  const response = await fetch('/api/explanation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ concept, mode, context }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to generate concept explanation');
  }

  return response.json();
}

export async function fetchChatHistorySessions(): Promise<any[]> {
  const response = await fetch('/api/chat-history/sessions');
  if (!response.ok) return [];
  const data = await response.json();
  return data.sessions || [];
}

export async function fetchChatHistorySessionById(id: string): Promise<any | null> {
  const response = await fetch(`/api/chat-history/sessions/${id}`);
  if (!response.ok) return null;
  const data = await response.json();
  return data.session || null;
}

export async function createChatHistorySession(
  title: string,
  messages: ChatMessage[],
  persona = 'Standard Tutor'
): Promise<any> {
  const response = await fetch('/api/chat-history/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, messages, persona }),
  });
  if (!response.ok) throw new Error('Failed to create chat history session');
  const data = await response.json();
  return data.session;
}

export async function deleteChatHistorySession(id: string): Promise<boolean> {
  const response = await fetch(`/api/chat-history/sessions/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) return false;
  const data = await response.json();
  return data.success;
}

export async function clearAllChatHistory(): Promise<boolean> {
  const response = await fetch('/api/chat-history/clear-all', {
    method: 'DELETE',
  });
  if (!response.ok) return false;
  const data = await response.json();
  return data.success;
}

export async function generateSpeechAudio(text: string, voice = 'Kore'): Promise<string> {
  const response = await fetch('/api/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate speech audio');
  }

  const data = await response.json();
  return data.audioBase64;
}

export async function generateStudyPlan(params: {
  subjects: string[];
  examDate: string;
  hoursPerDay: number;
  focusAreas?: string;
}): Promise<any> {
  const response = await fetch('/api/study-planner/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to generate AI study plan');
  }

  const data = await response.json();
  return data.plan;
}

export async function recalibrateStudyPlan(params: {
  planId: string;
  missedTopics: string[];
  daysRemaining?: number;
}): Promise<any> {
  const response = await fetch('/api/study-planner/recalibrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to recalibrate study plan');
  }

  const data = await response.json();
  return data.plan;
}

export async function toggleStudyTopic(planId: string, topicId: string): Promise<any> {
  const response = await fetch('/api/study-planner/toggle-topic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId, topicId }),
  });

  if (!response.ok) {
    throw new Error('Failed to toggle topic completion status');
  }

  const data = await response.json();
  return data.plan;
}

export async function fetchLatestStudyPlan(): Promise<any | null> {
  const response = await fetch('/api/study-planner/latest');
  if (!response.ok) return null;
  const data = await response.json();
  return data.plan || null;
}

export async function fetchUserPreferences(userId = '1'): Promise<any> {
  const response = await fetch(`/api/user-preferences?userId=${userId}`);
  if (!response.ok) return null;
  const data = await response.json();
  return data.preferences;
}

export async function updateUserPreferences(updates: any, userId = '1'): Promise<any> {
  const response = await fetch('/api/user-preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, updates }),
  });
  if (!response.ok) throw new Error('Failed to update preferences');
  const data = await response.json();
  return data.preferences;
}

export async function fetchAiLogs(userId = '1'): Promise<any> {
  const response = await fetch(`/api/ai-logs?userId=${userId}`);
  if (!response.ok) return { logs: [], stats: {} };
  return response.json();
}

export async function fetchRecentSearches(userId = '1'): Promise<any[]> {
  const response = await fetch(`/api/search-history?userId=${userId}`);
  if (!response.ok) return [];
  const data = await response.json();
  return data.searches || [];
}

export async function recordSearchHistory(keyword: string, category = 'all', resultCount = 0): Promise<any> {
  const response = await fetch('/api/search-history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyword, category, resultCount }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data.entry;
}

export async function fetchRecentDocuments(userId = '1'): Promise<any[]> {
  const response = await fetch(`/api/recent-documents?userId=${userId}`);
  if (!response.ok) return [];
  const data = await response.json();
  return data.items || [];
}

export async function recordDocumentAccess(documentId: string, documentTitle: string, documentType = 'pdf'): Promise<any> {
  const response = await fetch('/api/recent-documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId, documentTitle, documentType }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data.entry;
}

export async function renameChatSession(id: string, title: string): Promise<any> {
  const response = await fetch(`/api/chat-history/sessions/${id}/rename`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) throw new Error('Failed to rename chat session');
  const data = await response.json();
  return data.session;
}

export async function archiveChatSession(id: string, isArchived = true): Promise<any> {
  const response = await fetch(`/api/chat-history/sessions/${id}/archive`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isArchived }),
  });
  if (!response.ok) throw new Error('Failed to archive chat session');
  const data = await response.json();
  return data.session;
}

export async function searchChatSessions(q: string): Promise<any[]> {
  const response = await fetch(`/api/chat-history/search?q=${encodeURIComponent(q)}`);
  if (!response.ok) return [];
  const data = await response.json();
  return data.sessions || [];
}

export async function transformSelectedText(
  text: string,
  action: 'explain' | 'rewrite' | 'translate',
  option?: string
): Promise<{ resultText: string }> {
  const response = await fetch('/api/ai/transform-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, action, option }),
  });
  if (!response.ok) throw new Error('Failed to transform text');
  return response.json();
}

export async function generateCitations(
  title: string,
  author?: string,
  year?: string,
  publisherUrl?: string
): Promise<{ apa: string; harvard: string; ieee: string; mla: string; chicago: string }> {
  const response = await fetch('/api/ai/citations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, author, year, publisherUrl }),
  });
  if (!response.ok) throw new Error('Failed to generate citations');
  const data = await response.json();
  return data.citations;
}

export async function solveFormula(
  formula: string,
  givenVariables?: string
): Promise<any> {
  const response = await fetch('/api/ai/solve-formula', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ formula, givenVariables }),
  });
  if (!response.ok) throw new Error('Failed to solve formula');
  const data = await response.json();
  return data.solution;
}

export async function analyzeCode(
  code: string,
  language = 'auto'
): Promise<any> {
  const response = await fetch('/api/ai/code-explainer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, language }),
  });
  if (!response.ok) throw new Error('Failed to analyze code');
  const data = await response.json();
  return data.analysis;
}

export async function predictExamQuestions(sourcesContent: string): Promise<any> {
  const response = await fetch('/api/ai/predict-exam', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourcesContent }),
  });
  if (!response.ok) throw new Error('Failed to predict exam questions');
  const data = await response.json();
  return data.examPredictions;
}

export async function synthesizeMultiDocuments(
  documents: { title: string; content: string }[],
  query: string
): Promise<{ synthesisAnswer: string; sourcesAnalyzed: string[] }> {
  const response = await fetch('/api/ai/multi-doc-synthesis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documents, query }),
  });
  if (!response.ok) throw new Error('Failed to synthesize multi-document response');
  const data = await response.json();
  return data.synthesis;
}

export async function generatePowerPointSlides(
  topic: string,
  content?: string,
  slideCount = 5
): Promise<any> {
  const response = await fetch('/api/ai/generate-slides', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, content, slideCount }),
  });
  if (!response.ok) throw new Error('Failed to generate slides');
  const data = await response.json();
  return data.deck;
}

export async function generateDiagram(
  topic: string,
  diagramType = 'flowchart'
): Promise<any> {
  const response = await fetch('/api/ai/generate-diagram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, diagramType }),
  });
  if (!response.ok) throw new Error('Failed to generate diagram');
  const data = await response.json();
  return data.diagram;
}

export async function generateCheatSheet(
  topic: string,
  content?: string
): Promise<any> {
  const response = await fetch('/api/ai/generate-cheatsheet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, content }),
  });
  if (!response.ok) throw new Error('Failed to generate cheat sheet');
  const data = await response.json();
  return data.cheatSheet;
}

export async function generateMnemonics(
  topic: string,
  itemsToRemember: string[]
): Promise<any> {
  const response = await fetch('/api/ai/generate-mnemonics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, itemsToRemember }),
  });
  if (!response.ok) throw new Error('Failed to generate mnemonics');
  return response.json();
}

export async function generateVivaQuestions(subject: string): Promise<any[]> {
  const response = await fetch('/api/ai/viva-questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject }),
  });
  if (!response.ok) throw new Error('Failed to generate viva questions');
  const data = await response.json();
  return data.questions;
}

export async function evaluateVivaAnswer(
  question: string,
  studentAnswer: string,
  expectedKeywords: string[]
): Promise<any> {
  const response = await fetch('/api/ai/evaluate-viva', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, studentAnswer, expectedKeywords }),
  });
  if (!response.ok) throw new Error('Failed to evaluate viva answer');
  const data = await response.json();
  return data.evaluation;
}


