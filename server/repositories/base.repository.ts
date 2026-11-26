import { Request } from 'express';
import { ApiError } from '../middleware/validate.middleware';

export interface AuthContext {
  userId: string;
  idToken: string;
  email?: string;
  role?: 'Student' | 'Educator' | 'Admin';
}

export function getAuthContext(req: Request): AuthContext {
  if (!req.user?.uid || !req.idToken) {
    throw new ApiError(401, 'Authentication required.', 'AUTH_REQUIRED');
  }
  return {
    userId: req.user.uid,
    idToken: req.idToken,
    email: req.user.email,
    role: req.user.role,
  };
}

export function pickAllowedKeys<T extends Record<string, any>>(
  obj: T,
  allowedKeys: readonly string[]
): Record<string, any> {
  const out: Record<string, any> = {};
  for (const key of allowedKeys) {
    if (obj[key] !== undefined) {
      out[key] = obj[key];
    }
  }
  return out;
}

export function makeSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${rand}`.replace(/[^a-zA-Z0-9_\-]/g, '-');
}
