import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import apiRouter from './server/routes/index';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));

// Mount Clean Architecture Modular API Routes
app.use('/api', apiRouter);

// Sanctum Simulation Auth Routes
app.post('/api/v1/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  const sanctumToken = `1|sanctum_token_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  res.status(201).json({
    status: 'success',
    message: 'User registered via Laravel Sanctum',
    access_token: sanctumToken,
    token_type: 'Bearer',
    user: {
      id: 1,
      name: name || 'New Student',
      email: email || 'student@university.edu',
      role: 'Student',
    },
  });
});

app.post('/api/v1/auth/login', (req, res) => {
  const { email } = req.body;
  const sanctumToken = `1|sanctum_token_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  res.json({
    status: 'success',
    message: 'Authenticated successfully via Sanctum',
    access_token: sanctumToken,
    token_type: 'Bearer',
    user: {
      id: 1,
      name: 'Alex Rivera',
      email: email || 'alex.rivera@university.edu',
      role: 'Student',
      study_goal_minutes: 60,
      preferred_ai_model: 'Gemini 3.6 Flash',
    },
  });
});

app.get('/api/v1/auth/user', (req, res) => {
  res.json({
    status: 'success',
    user: {
      id: 1,
      name: 'Alex Rivera',
      email: 'alex.rivera@university.edu',
      role: 'Student',
      study_goal_minutes: 60,
      preferred_ai_model: 'Gemini 3.6 Flash',
      study_streak_days: 7,
      ai_tokens_consumed: 142500,
    },
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

// 2. Upload and Process Document
// All API routes are now modularized and handled by server/routes/index.ts
// ==========================================
// VITE MIDDLEWARE / STATIC SERVING
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 AI Study Assistant Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
