import dotenv from 'dotenv';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { firestoreRest } from './server/config/firestore_rest';
import { apiErrorHandler } from './server/middleware/validate.middleware';
import apiRouter from './server/routes/index';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(express.json({ limit: '15mb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 400,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests. Please slow down and try again shortly.',
    code: 'RATE_LIMITED',
  },
});

// Public health check endpoint
app.get('/api/health', (_req, res) => {
  const dbInfo = firestoreRest.getConfigInfo();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: {
      provider: 'firebase-firestore',
      projectId: dbInfo.projectId,
      databaseId: dbInfo.databaseId,
    },
    geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    aiProviders: {
      primary: process.env.AI_PRIMARY_PROVIDER || 'gemini',
      fallback: process.env.AI_FALLBACK_PROVIDER || 'openai',
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
      anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    },
    supportedFormats: ['pdf', 'docx', 'pptx', 'xlsx', 'csv', 'md', 'txt', 'png', 'jpg', 'webp', 'mp3', 'wav', 'webm', 'm4a', 'ogg', 'flac'],
  });
});

// Protected modular API routes
app.use('/api', apiLimiter, apiRouter);

// JSON 404 handler for unknown /api routes
app.use('/api', (_req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found.',
    code: 'NOT_FOUND',
  });
});

// Centralized API error middleware
app.use(apiErrorHandler);

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
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`StudyLMS Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
