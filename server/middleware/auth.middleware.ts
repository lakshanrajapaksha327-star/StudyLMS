import { Request, Response, NextFunction } from 'express';
import { adminAuth, PRIMARY_ADMIN_EMAIL } from '../lib/firebase-admin';
import { firestoreRest } from '../config/firestore_rest';

export interface AuthenticatedUser {
  uid: string;
  email: string;
  name: string;
  avatar?: string;
  emailVerified: boolean;
  role: 'Student' | 'Educator' | 'Admin';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      idToken?: string;
    }
  }
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Missing Bearer token.',
        code: 'AUTH_REQUIRED',
      });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const email = decoded.email || '';
    const isPrimaryAdmin =
      email.toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase() &&
      Boolean(decoded.email_verified);

    req.idToken = token;
    req.user = {
      uid: decoded.uid,
      email,
      name: decoded.name || email.split('@')[0] || 'Student',
      avatar: decoded.picture,
      emailVerified: Boolean(decoded.email_verified),
      role: isPrimaryAdmin ? 'Admin' : 'Student',
    };

    next();
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired authentication session. Please sign in again.',
      code: 'INVALID_TOKEN',
    });
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return next();
    }
    const decoded = await adminAuth.verifyIdToken(token);
    const email = decoded.email || '';
    const isPrimaryAdmin =
      email.toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase() &&
      Boolean(decoded.email_verified);

    req.idToken = token;
    req.user = {
      uid: decoded.uid,
      email,
      name: decoded.name || email.split('@')[0] || 'Student',
      avatar: decoded.picture,
      emailVerified: Boolean(decoded.email_verified),
      role: isPrimaryAdmin ? 'Admin' : 'Student',
    };
  } catch {
    // Ignore invalid optional token and leave req.user undefined
  }
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.idToken) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required.',
      code: 'AUTH_REQUIRED',
    });
  }

  if (
    req.user.email.toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase() &&
    req.user.emailVerified
  ) {
    req.user.role = 'Admin';
    return next();
  }

  try {
    const profile = await firestoreRest.getDoc<{ role?: string }>(
      'users',
      req.user.uid,
      req.idToken
    );
    if (profile?.role === 'Admin') {
      req.user.role = 'Admin';
      return next();
    }
  } catch {
    // Deny below
  }

  return res.status(403).json({
    success: false,
    error: 'Administrator privileges required.',
    code: 'FORBIDDEN',
  });
}
