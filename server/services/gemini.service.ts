import { Type } from '@google/genai';
import { getGeminiClient } from '../config/gemini';
import { ExplanationMode, ExplanationResponse } from '../models/explanation.model';
import { ChatMessageModel } from '../models/chat.model';

export class GeminiService {
  /**
   * Summarize document content and extract key concepts and starter flashcards
   */
  public async summarizeDocument(title: string, textContent: string) {
    const ai = getGeminiClient();

    const prompt = `Analyze the study document titled "${title}".
Document Content:
${textContent.slice(0, 15000)}

Provide:
1. A concise overview summary (2-3 sentences).
2. Up to 5 key concepts or technical terms.
3. 3 starter flashcards (question, answer, and optional hint) based directly on this document.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            keyConcepts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            flashcards: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  answer: { type: Type.STRING },
                  hint: { type: Type.STRING },
                },
                required: ['question', 'answer'],
              },
            },
          },
          required: ['summary', 'keyConcepts', 'flashcards'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
      summary: parsed.summary || 'Summary generated.',
      keyConcepts: parsed.keyConcepts || [],
      flashcards: parsed.flashcards || [],
    };
  }

  /**
   * Document chat response generation grounded in source documents
   */
  public async generateChatResponse(
    messages: ChatMessageModel[],
    sourcesContext: string,
    persona: string = 'Standard Tutor',
    notebookTitle: string = 'General Study'
  ) {
    const ai = getGeminiClient();

    let personaInstruction =
      'You are a top-tier AI Study Assistant inspired by NotebookLM, ChatGPT, Notion AI, and Quizlet. Your goal is to help students learn effectively with clean Markdown, math formulas, clear key callouts, and examples.';

    if (persona === 'Socratic Tutor') {
      personaInstruction +=
        ' Act as a Socratic Tutor: guide the user with thoughtful follow-up questions instead of giving immediate direct answers.';
    } else if (persona === 'Exam Coach') {
      personaInstruction +=
        ' Act as an Exam Coach: focus on high-yield test topics, likely exam questions, core formulas, and memory mnemonics.';
    } else if (persona === 'Simplified Explainer') {
      personaInstruction +=
        ' Act as a Simplified Explainer (ELI5): explain concepts using simple analogies, visual breakdown, and zero jargon.';
    }

    const systemPrompt = `${personaInstruction}
Current Study Notebook Context: ${notebookTitle}

${
  sourcesContext
    ? `Grounding Study Sources Available:\n${sourcesContext}\nWhen answering, cite specific source titles in brackets like [Source: "Title"] if information originates from uploaded sources.`
    : 'No explicit sources attached. Answer using comprehensive AI domain knowledge.'
}

Structure your response:
1. Provide a well-structured, clear, and engaging answer with Markdown headings, bullet points, and code/math formatting if relevant.
2. At the end, provide 3 suggested follow-up questions that the student can ask next.`;

    const conversationHistory = messages
      .map((m) => `${m.sender === 'user' ? 'Student' : 'AI Assistant'}: ${m.text}`)
      .join('\n');

    const prompt = `${systemPrompt}\n\nConversation History:\n${conversationHistory}\n\nAI Assistant:`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        temperature: 0.7,
      },
    });

    const replyText = response.text || 'I am ready to help you study!';

    let text = replyText;
    let suggestedQuestions: string[] = [];

    const suggestedIndex = text.indexOf('Suggested follow-up questions:');
    if (suggestedIndex !== -1) {
      const mainContent = text.slice(0, suggestedIndex).trim();
      const followUpSection = text.slice(suggestedIndex);
      suggestedQuestions = followUpSection
        .split('\n')
        .filter((line) => line.trim().startsWith('-') || line.trim().match(/^\d+\./))
        .map((line) => line.replace(/^[-\d.]+\s*/, '').trim())
        .slice(0, 3);
      text = mainContent;
    } else {
      suggestedQuestions = [
        'Can you give me a real-world example?',
        'Can you create 3 flashcards for this concept?',
        'What are the most common exam traps here?',
      ];
    }

    return { text, suggestedQuestions };
  }

  /**
   * Flashcard generation using Gemini API
   */
  public async generateFlashcards(topic: string, sourceContent: string, count: number = 5) {
    const ai = getGeminiClient();

    const prompt = `You are a Quizlet AI Flashcard Generator.
Topic/Source: ${topic || 'General Subject'}
Source Detail: ${(sourceContent || '').slice(0, 10000)}

Generate ${count} flashcards. Each card must have a precise "question", a clear "answer", and an optional "hint".`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              answer: { type: Type.STRING },
              hint: { type: Type.STRING },
            },
            required: ['question', 'answer'],
          },
        },
      },
    });

    return JSON.parse(response.text || '[]');
  }

  /**
   * Practice Quiz generation using Gemini API
   */
  public async generateQuiz(topic: string, sourceContent: string, count: number = 4) {
    const ai = getGeminiClient();

    const prompt = `You are an AI Practice Test Generator.
Topic: ${topic || 'General Subject'}
Content context: ${(sourceContent || '').slice(0, 10000)}

Generate ${count} practice test questions including multiple-choice, true-false, and short-answer types.
Provide 4 options for multiple choice. Include a thorough "explanation" for why the correct answer is right.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: {
                type: Type.STRING,
                description: 'multiple-choice | true-false | short-answer',
              },
              question: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              correctAnswer: { type: Type.STRING },
              explanation: { type: Type.STRING },
            },
            required: ['type', 'question', 'correctAnswer', 'explanation'],
          },
        },
      },
    });

    return JSON.parse(response.text || '[]');
  }

  /**
   * Multi-mode explanation generation (Socratic, ELI5, Step-by-Step, Deep Dive, Analogy)
   */
  public async generateExplanation(
    concept: string,
    mode: ExplanationMode,
    context?: string
  ): Promise<ExplanationResponse> {
    const ai = getGeminiClient();

    let modeInstruction = '';
    switch (mode) {
      case 'socratic':
        modeInstruction = 'Explain using the Socratic Method: ask guiding questions, prompt active critical thinking, and lead the student step by step.';
        break;
      case 'eli5':
        modeInstruction = 'Explain Like I Am 5 (ELI5): use simple everyday analogies, simple language, no jargon, and vivid visual examples.';
        break;
      case 'step_by_step':
        modeInstruction = 'Break down the concept into a clear, sequentially numbered step-by-step tutorial or algorithm.';
        break;
      case 'deep_dive':
        modeInstruction = 'Provide a rigorous, comprehensive technical deep dive with underlying principles, formulas, edge cases, and architectural context.';
        break;
      case 'analogy':
        modeInstruction = 'Explain entirely through a striking, intuitive real-world physical or mental analogy.';
        break;
    }

    const prompt = `Concept to Explain: "${concept}"
${context ? `Additional Context: ${context.slice(0, 5000)}` : ''}

Explanation Mode Instruction: ${modeInstruction}

Format the output in JSON:
- "explanation": markdown text containing the full structured explanation.
- "keyTakeaways": array of 3 bullet points summarizing core principles.
- "suggestedFollowUps": array of 3 follow-up questions or study actions.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            explanation: { type: Type.STRING },
            keyTakeaways: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            suggestedFollowUps: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['explanation', 'keyTakeaways', 'suggestedFollowUps'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');

    return {
      concept,
      mode,
      explanation: parsed.explanation || 'Explanation generated.',
      keyTakeaways: parsed.keyTakeaways || [],
      suggestedFollowUps: parsed.suggestedFollowUps || [],
    };
  }

  /**
   * AI Study Planner Schedule & Strategy Generation
   */
  public async generateStudyPlan(
    subjects: string[],
    examDate: string,
    hoursPerDay: number,
    focusAreas?: string
  ) {
    const ai = getGeminiClient();

    const prompt = `You are an expert Academic Advisor and Learning Scientist AI.
Build an optimized personalized study schedule for a student.

Input Details:
- Subjects: ${subjects.join(', ')}
- Target Exam Date: ${examDate}
- Daily Available Study Hours: ${hoursPerDay} hours/day
${focusAreas ? `- Specific Focus/Weak Areas: ${focusAreas}` : ''}

Generate a 7-day or 10-day structured day-by-day roadmap leading to the exam:
1. Provide a day-by-day breakdown with focus subjects, specific topics to master, estimated hours per topic, and priority.
2. Provide a list of prioritized high-yield exam topics.
3. Provide 3 actionable adaptive study tips (e.g., Active Recall, Pomodoro distribution, Spaced Repetition).`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            schedule: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  dayNumber: { type: Type.INTEGER },
                  dayOfWeek: { type: Type.STRING },
                  focusSubject: { type: Type.STRING },
                  totalHours: { type: Type.NUMBER },
                  notes: { type: Type.STRING },
                  topics: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        subject: { type: Type.STRING },
                        topicName: { type: Type.STRING },
                        estimatedHours: { type: Type.NUMBER },
                        priority: { type: Type.STRING, description: 'High | Medium | Low' },
                      },
                      required: ['subject', 'topicName', 'estimatedHours', 'priority'],
                    },
                  },
                },
                required: ['dayNumber', 'focusSubject', 'topics', 'totalHours'],
              },
            },
            prioritizedTopics: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            adaptiveTips: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['title', 'schedule', 'prioritizedTopics', 'adaptiveTips'],
        },
      },
    });

    return JSON.parse(response.text || '{}');
  }

  /**
   * Recalibrate Study Plan when student falls behind or changes pace
   */
  public async recalibrateStudyPlan(
    existingPlanTitle: string,
    subjects: string[],
    missedTopics: string[],
    daysRemaining: number,
    hoursPerDay: number
  ) {
    const ai = getGeminiClient();

    const prompt = `You are an AI Adaptive Study Coach.
The student fell behind on their schedule for "${existingPlanTitle}".

Current Status:
- Subjects: ${subjects.join(', ')}
- Missed / Incomplete Topics that need urgent catching up: ${missedTopics.join(', ') || 'None specified'}
- Days Remaining until Exam: ${daysRemaining} days
- Daily Available Study Hours: ${hoursPerDay} hours/day

Re-balance and generate a fresh optimized catch-up study schedule for the remaining ${Math.min(daysRemaining, 7)} days!
Prioritize high-weight missed topics first, compress review sessions, and provide emergency recovery advice.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            schedule: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  dayNumber: { type: Type.INTEGER },
                  dayOfWeek: { type: Type.STRING },
                  focusSubject: { type: Type.STRING },
                  totalHours: { type: Type.NUMBER },
                  notes: { type: Type.STRING },
                  topics: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        subject: { type: Type.STRING },
                        topicName: { type: Type.STRING },
                        estimatedHours: { type: Type.NUMBER },
                        priority: { type: Type.STRING },
                      },
                      required: ['subject', 'topicName', 'estimatedHours', 'priority'],
                    },
                  },
                },
                required: ['dayNumber', 'focusSubject', 'topics', 'totalHours'],
              },
            },
            prioritizedTopics: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            adaptiveTips: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['title', 'schedule', 'prioritizedTopics', 'adaptiveTips'],
        },
      },
    });

    return JSON.parse(response.text || '{}');
  }

  /**
   * Explain, Rewrite, or Translate Selected Text
   */
  public async transformText(
    selectedText: string,
    action: 'explain' | 'rewrite' | 'translate',
    option: string = 'Standard'
  ) {
    const ai = getGeminiClient();

    let prompt = '';
    if (action === 'explain') {
      prompt = `You are an expert AI Educator. Explain the following text clearly for a student:
Text:
"${selectedText}"

Provide:
1. Simplified breakdown in plain language.
2. 3 key takeaway bullet points.
3. A real-world analogy.`;
    } else if (action === 'rewrite') {
      prompt = `Rewrite the following text according to the style constraint "${option}":
Text:
"${selectedText}"

Ensure the output is well-formatted Markdown matching style "${option}".`;
    } else {
      prompt = `Translate the following academic text accurately into ${option}:
Text:
"${selectedText}"`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
    });

    return { resultText: response.text || '' };
  }

  /**
   * Generate Citations in APA, Harvard, IEEE, MLA, and Chicago styles
   */
  public async generateCitations(
    sourceTitle: string,
    author: string = 'Unknown Author',
    year: string = '2024',
    publisherUrl: string = 'Academic Study Source'
  ) {
    const ai = getGeminiClient();

    const prompt = `Generate standardized academic citations for the following source:
Title: "${sourceTitle}"
Author(s): "${author}"
Year: "${year}"
Publisher/URL: "${publisherUrl}"

Return JSON with keys:
- apa: APA 7th Edition style citation
- harvard: Harvard style citation
- ieee: IEEE style citation
- mla: MLA 9th Edition style citation
- chicago: Chicago 17th Edition style citation`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            apa: { type: Type.STRING },
            harvard: { type: Type.STRING },
            ieee: { type: Type.STRING },
            mla: { type: Type.STRING },
            chicago: { type: Type.STRING },
          },
          required: ['apa', 'harvard', 'ieee', 'mla', 'chicago'],
        },
      },
    });

    return JSON.parse(response.text || '{}');
  }

  /**
   * Solve Formulas and Equations Step-by-Step
   */
  public async solveFormula(formulaText: string, givenVariables: string = '') {
    const ai = getGeminiClient();

    const prompt = `You are an AI Math and Science Formula Solver.
Equation/Formula to Solve: "${formulaText}"
Given Variables/Values: "${givenVariables || 'None provided'}"

Provide a structured response:
1. Formula identification & standard units.
2. Step-by-step solution derivation.
3. Final calculated answer or simplified symbolic formula.
4. Practice application tip or unit check.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            formulaName: { type: Type.STRING },
            standardFormulaLatex: { type: Type.STRING },
            variableBreakdown: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            solutionSteps: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            finalAnswer: { type: Type.STRING },
            unitCheck: { type: Type.STRING },
          },
          required: ['formulaName', 'solutionSteps', 'finalAnswer'],
        },
      },
    });

    return JSON.parse(response.text || '{}');
  }

  /**
   * Code Line-by-Line Explainer & Bug Finder
   */
  public async analyzeCodeAndFindBugs(codeSnippet: string, language: string = 'auto') {
    const ai = getGeminiClient();

    const prompt = `You are a Senior Software Architect and CS Educator AI.
Analyze the following code snippet:
Programming Language: ${language}
Code:
\`\`\`${language}
${codeSnippet}
\`\`\`

Tasks:
1. Provide a high-level explanation of what the code does.
2. Provide a line-by-line / block breakdown.
3. Identify potential bugs, logical errors, edge cases, or performance bottlenecks.
4. Provide the refactored, corrected, and clean bug-free code.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overview: { type: Type.STRING },
            lineByLineExplanation: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            bugsFound: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  severity: { type: Type.STRING, description: 'Critical | Major | Minor' },
                  issue: { type: Type.STRING },
                  fixSuggestion: { type: Type.STRING },
                },
                required: ['severity', 'issue', 'fixSuggestion'],
              },
            },
            correctedCode: { type: Type.STRING },
            performanceTips: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['overview', 'lineByLineExplanation', 'bugsFound', 'correctedCode'],
        },
      },
    });

    return JSON.parse(response.text || '{}');
  }

  /**
   * AI Probable Exam Questions Predictor
   */
  public async predictExamQuestions(sourcesContent: string) {
    const ai = getGeminiClient();

    const prompt = `You are an AI Professor & Exam Preparation Specialist.
Analyze the following study materials and predict probable exam questions:

Study Material Excerpt:
${sourcesContent.slice(0, 20000)}

Generate 5 high-probability exam questions:
Include a mix of Multiple Choice, Short Answer, and Comprehensive Essay questions.
For each question, provide probability score (%), difficulty level, ideal scoring answer, and common mistakes to avoid.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            examSummary: { type: Type.STRING },
            predictedQuestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  questionText: { type: Type.STRING },
                  type: { type: Type.STRING, description: 'Multiple Choice | Short Answer | Essay' },
                  probabilityPercent: { type: Type.INTEGER },
                  difficulty: { type: Type.STRING, description: 'Easy | Medium | Hard' },
                  idealModelAnswer: { type: Type.STRING },
                  commonMistakesToAvoid: { type: Type.STRING },
                },
                required: ['questionText', 'type', 'probabilityPercent', 'difficulty', 'idealModelAnswer'],
              },
            },
          },
          required: ['examSummary', 'predictedQuestions'],
        },
      },
    });

    return JSON.parse(response.text || '{}');
  }

  /**
   * Multi-Document Cross Synthesis Query
   */
  public async synthesizeMultiDocuments(
    documents: { title: string; content: string }[],
    userQuery: string
  ) {
    const ai = getGeminiClient();

    const formattedDocs = documents
      .map((doc, idx) => `=== Document #${idx + 1}: "${doc.title}" ===\n${doc.content.slice(0, 8000)}`)
      .join('\n\n');

    const prompt = `You are NotebookLM's Multi-Document Synthesis AI.
User Query: "${userQuery}"

Available Grounding Documents (${documents.length} sources):
${formattedDocs}

Synthesize a comprehensive answer:
1. Provide a unified synthesis answering the user query.
2. Explicitly cite which information came from which document (e.g. [Doc: "Title"]).
3. Highlight agreements or contrasting viewpoints between the documents.
4. List 3 key takeaway insights.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
    });

    return {
      synthesisAnswer: response.text || '',
      sourcesAnalyzed: documents.map((d) => d.title),
    };
  }

  /**
   * AI PowerPoint Slide Deck Generator
   */
  public async generatePowerPointSlides(topic: string, content: string, slideCount: number = 5) {
    const ai = getGeminiClient();

    const prompt = `You are an AI Presentation & Slide Deck Designer.
Topic: "${topic}"
Context/Content: "${(content || '').slice(0, 10000)}"

Generate a structured presentation slide deck with ${slideCount} slides:
For each slide provide:
1. "slideNumber": integer
2. "title": slide headline
3. "bulletPoints": array of 3-4 concise, impactful presentation points
4. "speakerNotes": detailed talking points for the presenter
5. "recommendedVisual": suggested diagram, image, or graphic idea`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            deckTitle: { type: Type.STRING },
            subtitle: { type: Type.STRING },
            slides: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  slideNumber: { type: Type.INTEGER },
                  title: { type: Type.STRING },
                  bulletPoints: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  speakerNotes: { type: Type.STRING },
                  recommendedVisual: { type: Type.STRING },
                },
                required: ['slideNumber', 'title', 'bulletPoints', 'speakerNotes'],
              },
            },
          },
          required: ['deckTitle', 'slides'],
        },
      },
    });

    return JSON.parse(response.text || '{}');
  }

  /**
   * AI Diagram & Flowchart Generator (Mermaid.js)
   */
  public async generateDiagram(topic: string, diagramType: string = 'flowchart') {
    const ai = getGeminiClient();

    const prompt = `You are an expert Diagram & Concept Map Architect AI.
Topic/Concept: "${topic}"
Diagram Type: "${diagramType}" (flowchart, sequence, mindmap, classDiagram)

Generate valid Mermaid.js syntax for this diagram, along with a step-by-step text description of key nodes and relationships.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            mermaidSyntax: { type: Type.STRING },
            description: { type: Type.STRING },
            keyNodes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                },
                required: ['label', 'explanation'],
              },
            },
          },
          required: ['title', 'mermaidSyntax', 'description'],
        },
      },
    });

    return JSON.parse(response.text || '{}');
  }

  /**
   * AI Cheat Sheet Generator
   */
  public async generateCheatSheet(topic: string, content: string) {
    const ai = getGeminiClient();

    const prompt = `You are an AI Academic Cheat Sheet Creator.
Topic: "${topic}"
Source Text: "${(content || '').slice(0, 10000)}"

Create a high-yield, super-dense 1-page reference cheat sheet:
1. Key Definitions & Vocabulary
2. Critical Formulas & Equations
3. Main Rules / Laws / Axioms
4. Top 5 Exam Pitfalls to Avoid`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subject: { type: Type.STRING },
            keyTerms: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  term: { type: Type.STRING },
                  definition: { type: Type.STRING },
                },
                required: ['term', 'definition'],
              },
            },
            formulas: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  formula: { type: Type.STRING },
                  usage: { type: Type.STRING },
                },
                required: ['name', 'formula'],
              },
            },
            keyLaws: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            topMistakes: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['subject', 'keyTerms', 'formulas', 'keyLaws', 'topMistakes'],
        },
      },
    });

    return JSON.parse(response.text || '{}');
  }

  /**
   * AI Mnemonics Generator
   */
  public async generateMnemonics(topic: string, itemsToRemember: string[]) {
    const ai = getGeminiClient();

    const prompt = `You are a Cognitive Memory Specialist AI.
Topic: "${topic}"
Items/Concepts to Memorize: ${JSON.stringify(itemsToRemember)}

Generate 3 unique memory tricks/mnemonics:
1. Acronym or First-Letter Mnemonic
2. Story / Peg Word Association
3. Visual Rhyme or Physical Action Cue`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mnemonics: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  mnemonicText: { type: Type.STRING },
                  breakdown: { type: Type.STRING },
                  visualHook: { type: Type.STRING },
                },
                required: ['type', 'mnemonicText', 'breakdown'],
              },
            },
          },
          required: ['mnemonics'],
        },
      },
    });

    return JSON.parse(response.text || '{}');
  }

  /**
   * AI Viva Voce Oral Questions & Answer Evaluator
   */
  public async generateVivaQuestions(subject: string) {
    const ai = getGeminiClient();

    const prompt = `You are a Senior University Examiner conducting an Oral Viva Voce examination in "${subject}".
Generate 3 challenging oral viva questions testing deep conceptual understanding.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              question: { type: Type.STRING },
              expectedKeywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              examinerHint: { type: Type.STRING },
            },
            required: ['question', 'expectedKeywords'],
          },
        },
      },
    });

    return JSON.parse(response.text || '[]');
  }

  public async evaluateVivaAnswer(question: string, studentAnswer: string, expectedKeywords: string[]) {
    const ai = getGeminiClient();

    const prompt = `You are a Viva Voce Examiner scoring a student's oral/written response.
Question: "${question}"
Expected Keywords/Concepts: ${JSON.stringify(expectedKeywords)}
Student's Answer: "${studentAnswer}"

Evaluate and score out of 100:
1. Score (0-100)
2. Grade (Distinction, Pass, Borderline, Fail)
3. Strong points in the answer
4. Missing key concepts
5. Examiner's feedback for improvement`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER },
            grade: { type: Type.STRING },
            strengths: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            missingConcepts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            feedback: { type: Type.STRING },
          },
          required: ['score', 'grade', 'strengths', 'missingConcepts', 'feedback'],
        },
      },
    });

    return JSON.parse(response.text || '{}');
  }
}

export const geminiService = new GeminiService();
