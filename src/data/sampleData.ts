import { Notebook, SourceDocument, NoteItem, FlashcardSet, QuizSet, StudyStats } from '../types';

export const initialNotebooks: Notebook[] = [
  {
    id: 'nb-1',
    title: 'Computer Science & AI Foundations',
    description: 'Deep neural networks, transformers, search algorithms, and machine learning principles.',
    color: 'from-blue-600 to-indigo-600',
    createdAt: '2026-07-01',
    updatedAt: '2026-07-20'
  },
  {
    id: 'nb-2',
    title: 'Molecular & Cell Biology',
    description: 'Cellular respiration, gene expression, CRISPR technology, and protein synthesis.',
    color: 'from-emerald-600 to-teal-600',
    createdAt: '2026-07-05',
    updatedAt: '2026-07-21'
  },
  {
    id: 'nb-3',
    title: 'Microeconomics & Game Theory',
    description: 'Supply & demand dynamics, market equilibria, Nash equilibrium, and oligopolies.',
    color: 'from-amber-600 to-orange-600',
    createdAt: '2026-07-10',
    updatedAt: '2026-07-22'
  }
];

export const initialSources: SourceDocument[] = [
  {
    id: 'src-1',
    notebookId: 'nb-1',
    title: 'Attention Is All You Need - Transformer Architecture Summary.pdf',
    type: 'pdf',
    fileSize: '1.4 MB',
    addedAt: '2026-07-15',
    summary: 'The Transformer architecture discards recurrence and convolutions, relying entirely on self-attention mechanisms to draw global dependencies between input and output representations.',
    keyConcepts: ['Self-Attention Mechanism', 'Multi-Head Attention', 'Positional Encoding', 'Encoder-Decoder Blocks'],
    citationCount: 14,
    content: `The Transformer model relies entirely on an attention mechanism to draw global dependencies between input and output.
Key components include:
1. Scaled Dot-Product Attention: Attention(Q, K, V) = softmax(Q * K^T / sqrt(d_k)) * V.
2. Multi-Head Attention: Allows the model to jointly attend to information from different representation subspaces at different positions.
3. Positional Encoding: Since there is no recurrence, sinusoids or learned embeddings are added to input embeddings to convey word order.
4. Feed-Forward Networks: Applied to each position separately and identically with ReLU or GELU activations.
Transformers achieve state-of-the-art results in translation, code synthesis, and large language modeling.`
  },
  {
    id: 'src-2',
    notebookId: 'nb-1',
    title: 'Gradient Descent & Backpropagation Notes.md',
    type: 'markdown',
    fileSize: '320 KB',
    addedAt: '2026-07-18',
    summary: 'Core optimization techniques in neural network training including SGD, Adam optimizer, loss functions, and chain rule partial derivatives.',
    keyConcepts: ['Stochastic Gradient Descent', 'Adam Optimizer', 'Chain Rule', 'Learning Rate Schedulers'],
    citationCount: 9,
    content: `Backpropagation calculates the gradient of the loss function with respect to each weight using the chain rule of calculus.
1. Forward Pass: Compute predictions and loss function L(y_hat, y).
2. Backward Pass: Traverse back from output layer, computing partial derivative dL/dW.
3. Weight Update: W_new = W_old - alpha * grad_W.
Common optimizers:
- SGD with Momentum: Helps accelerate gradients in the right direction and dampens oscillations.
- Adam (Adaptive Moment Estimation): Maintains exponential moving averages of past gradients (m_t) and squared gradients (v_t).`
  },
  {
    id: 'src-3',
    notebookId: 'nb-2',
    title: 'Cellular Respiration & ATP Production Overview.txt',
    type: 'text',
    fileSize: '450 KB',
    addedAt: '2026-07-19',
    summary: 'Comprehensive breakdown of glycolysis, Krebs cycle, and oxidative phosphorylation yielding ~30-32 ATP per glucose molecule.',
    keyConcepts: ['Glycolysis', 'Krebs Cycle (Citric Acid Cycle)', 'Electron Transport Chain', 'ATP Synthase'],
    citationCount: 12,
    content: `Cellular respiration is the metabolic process converting biochemical energy from nutrients into ATP.
Stages:
1. Glycolysis (Cytosol): Glucose -> 2 Pyruvate + 2 ATP + 2 NADH (Anaerobic).
2. Pyruvate Oxidation & Krebs Cycle (Mitochondrial Matrix): Pyruvate converted to Acetyl-CoA, yielding 2 ATP, 6 NADH, 2 FADH2 per glucose.
3. Oxidative Phosphorylation (Inner Mitochondrial Membrane): Electron transport chain generates proton gradient (chemiosmosis), driving ATP Synthase to produce ~26-28 ATP.
Total net yield per glucose: 30 to 32 ATP molecules.`
  }
];

export const initialNotes: NoteItem[] = [
  {
    id: 'note-1',
    notebookId: 'nb-1',
    title: 'Transformer Self-Attention Quick Study Summary',
    updatedAt: '2026-07-21',
    tags: ['AI', 'Transformers', 'Key Formulas'],
    content: `# Transformer Self-Attention Quick Cheat Sheet

## Core Attention Formula
$$\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V$$

### Key Concepts
- **Queries (Q)**: What the token is looking for.
- **Keys (K)**: What the token offers.
- **Values (V)**: The actual content communicated.
- **Why scale by $\\sqrt{d_k}$?**: Prevents the dot products from growing excessively large for high dimensions, which would cause softmax gradients to vanish!

## Key Takeaway for Exams
When asked why Transformers replaced RNNs:
1. **Parallelization**: RNNs must process sequentially $O(N)$; Transformers process tokens in parallel $O(1)$ sequential steps during training.
2. **Long-Range Dependencies**: Attention computes direct paths between any two words regardless of distance.`
  },
  {
    id: 'note-2',
    notebookId: 'nb-2',
    title: 'Mitochondrial ATP Yield Breakdown',
    updatedAt: '2026-07-22',
    tags: ['Biology', 'Metabolism', 'ATP'],
    content: `# ATP Yield Summary Table

| Phase | Location | ATP Yield | Coenzymes Produced |
|---|---|---|---|
| Glycolysis | Cytosol | 2 Net ATP | 2 NADH |
| Pyruvate Oxidation | Matrix | 0 ATP | 2 NADH |
| Citric Acid Cycle | Matrix | 2 ATP | 6 NADH, 2 FADH2 |
| Oxidative Phosphorylation | Inner Membrane | ~26-28 ATP | Converts NADH/FADH2 |

**Key Question**: How does ATP Synthase act like a rotary motor?
Proton gradient drives the F0 rotor subunit, causing conformational changes in F1 subunit that phosphorylate ADP + Pi into ATP.`
  }
];

export const initialFlashcardSets: FlashcardSet[] = [
  {
    id: 'fc-1',
    notebookId: 'nb-1',
    title: 'Transformer Architecture & Self-Attention Deck',
    description: 'Master key transformer components, mathematical operations, and attention heads.',
    category: 'Computer Science',
    createdAt: '2026-07-16',
    cards: [
      {
        id: 'c1',
        question: 'What is the formula for Scaled Dot-Product Attention?',
        answer: 'Attention(Q, K, V) = softmax( (Q * K^T) / sqrt(d_k) ) * V',
        hint: 'Divided by square root of key dimension d_k.',
        status: 'mastered'
      },
      {
        id: 'c2',
        question: 'Why do Transformers require Positional Encodings?',
        answer: 'Since self-attention operates on all sequence positions in parallel without recurrence or convolution, positional encodings inject order information into token embeddings.',
        hint: 'Think about how the model knows word order.',
        status: 'learning'
      },
      {
        id: 'c3',
        question: 'What is the main training advantage of Transformers over LSTMs/RNNs?',
        answer: 'Transformers allow full parallelization across input tokens during training, eliminating sequential time-step bottlenecks.',
        hint: 'Consider processing time on GPUs.',
        status: 'mastered'
      },
      {
        id: 'c4',
        question: 'What is Multi-Head Attention and why is it useful?',
        answer: 'It projects Q, K, and V into multiple lower-dimensional subspaces, allowing the model to jointly attend to information from different positions and context perspectives simultaneously.',
        hint: 'Multiple heads attend to different relationships (e.g. grammar vs semantics).',
        status: 'unstudied'
      }
    ]
  },
  {
    id: 'fc-2',
    notebookId: 'nb-2',
    title: 'Cellular Respiration & Bioenergetics',
    description: 'Core biochemistry terms: Glycolysis, Krebs cycle, and electron transport chain.',
    category: 'Biology',
    createdAt: '2026-07-19',
    cards: [
      {
        id: 'c201',
        question: 'Where does Glycolysis take place inside the cell?',
        answer: 'In the Cytosol (cytoplasm) of the cell.',
        hint: 'Outside the mitochondria.',
        status: 'mastered'
      },
      {
        id: 'c202',
        question: 'What is the net ATP yield of Glycolysis per glucose molecule?',
        answer: '2 Net ATP molecules (2 consumed, 4 produced).',
        hint: 'Smaller yield before mitochondria.',
        status: 'mastered'
      },
      {
        id: 'c203',
        question: 'What enzyme synthesizes ATP using the electrochemical proton gradient across the inner mitochondrial membrane?',
        answer: 'ATP Synthase.',
        hint: 'It operates like a rotary molecular engine.',
        status: 'learning'
      }
    ]
  }
];

export const initialQuizSets: QuizSet[] = [
  {
    id: 'qz-1',
    notebookId: 'nb-1',
    title: 'Neural Networks & Transformer Architecture Exam Prep',
    description: 'Test your understanding of self-attention mechanisms, optimization, and layer components.',
    createdAt: '2026-07-18',
    questions: [
      {
        id: 'q1',
        type: 'multiple-choice',
        question: 'What is the primary role of scaling by sqrt(d_k) in Scaled Dot-Product Attention?',
        options: [
          'To increase the learning rate of the attention weights',
          'To prevent dot products from growing large, which pushes softmax into vanishing gradient regions',
          'To reduce memory footprint on GPU tensor cores',
          'To convert floating point values to binary masks'
        ],
        correctAnswer: 'To prevent dot products from growing large, which pushes softmax into vanishing gradient regions',
        explanation: 'For large values of d_k, dot products grow large in magnitude, driving the softmax function into regions with extremely small gradients. Dividing by sqrt(d_k) counteracts this effect.'
      },
      {
        id: 'q2',
        type: 'true-false',
        question: 'True or False: Transformers process input sequences step-by-step sequentially during the forward training pass.',
        options: ['True', 'False'],
        correctAnswer: 'False',
        explanation: 'False! Unlike RNNs, Transformers process all sequence tokens simultaneously in parallel during training.'
      },
      {
        id: 'q3',
        type: 'short-answer',
        question: 'What vector components are multiplied with Values (V) in the attention equation?',
        correctAnswer: 'Softmax of scaled Query-Key matrix (softmax(QK^T / sqrt(d_k)))',
        explanation: 'The attention weight matrix resulting from softmax(QK^T / sqrt(d_k)) acts as weights applied to the Value vectors V.'
      }
    ]
  }
];

export const initialStats: StudyStats = {
  cardsMastered: 18,
  quizzesCompleted: 5,
  studyStreakDays: 7,
  timeSpentMinutes: 240,
  lastActive: 'Today'
};

export const initialHistory = [
  {
    id: 'log-1',
    type: 'quiz_completed' as const,
    title: 'Neural Networks & Transformer Architecture Exam Prep',
    details: 'Completed practice exam with 3 questions.',
    timestamp: '2026-07-22 08:45 AM',
    score: '100%'
  },
  {
    id: 'log-2',
    type: 'flashcard_review' as const,
    title: 'Transformer Architecture & Self-Attention Deck',
    details: 'Mastered 4 flashcards during review session.',
    timestamp: '2026-07-21 04:30 PM'
  },
  {
    id: 'log-3',
    type: 'source_added' as const,
    title: 'Attention Is All You Need - Transformer Architecture Summary.pdf',
    details: 'Indexed PDF document (1.4 MB) into Computer Science notebook.',
    timestamp: '2026-07-20 11:15 AM'
  },
  {
    id: 'log-4',
    type: 'ai_note_generated' as const,
    title: 'Mitochondrial ATP Yield Breakdown',
    details: 'Formatted study note with Notion AI Summarizer.',
    timestamp: '2026-07-19 02:20 PM'
  },
  {
    id: 'log-5',
    type: 'chat_query' as const,
    title: 'Asked AI: Explain Scaled Dot-Product Attention in simple terms',
    details: 'Grounded response using 2 citations from Transformer PDF.',
    timestamp: '2026-07-18 09:10 AM'
  }
];

export const initialUserProfile = {
  name: 'Alex Rivera',
  email: 'alex.rivera@university.edu',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
  role: 'Student' as const,
  studyGoalMinutes: 60,
  preferredAIModel: 'Gemini 2.5 Flash (Fast Grounding)'
};

export const initialAdminMetrics = {
  totalUsers: 1420,
  activeToday: 385,
  aiTokensUsed: 12450000,
  documentsIndexed: 4890,
  systemHealth: 'Optimal' as const
};

