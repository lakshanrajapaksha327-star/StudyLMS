import { Request, Response, NextFunction } from 'express';
import { ZodType } from 'zod';

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, code = 'API_ERROR', details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    req.body = parsed.data;
    next();
  };
}

export function isValidResourceId(id: string): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && /^[a-zA-Z0-9_\-]+$/.test(id);
}

function sanitizeErrorMessage(msg: string): string {
  return String(msg || '')
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/AIza[0-9A-Za-z\-_]{20,}/g, '[REDACTED_KEY]')
    .replace(/sk-(?:proj-|ant-)?[0-9A-Za-z\-_]{16,}/g, '[REDACTED_KEY]');
}

export function apiErrorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      error: sanitizeErrorMessage(err.message),
      code: err.code,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  const anyErr = err as any;
  if (anyErr?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: 'Uploaded file exceeds the maximum allowed file size limit.',
      code: 'FILE_TOO_LARGE',
    });
  }

  const status = typeof anyErr?.statusCode === 'number' ? anyErr.statusCode : 500;
  const isProd = process.env.NODE_ENV === 'production';
  const rawMessage =
    status < 500
      ? anyErr?.message || 'Bad request'
      : isProd
      ? 'An internal server error occurred. Please try again later.'
      : anyErr?.message || 'Internal server error';

  console.error(`[API Error] ${req.method} ${req.originalUrl}:`, sanitizeErrorMessage(anyErr?.message || String(err)));

  res.status(status).json({
    success: false,
    error: sanitizeErrorMessage(rawMessage),
    code: anyErr?.code || 'INTERNAL_ERROR',
  });
}
