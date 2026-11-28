import { Request, Response, NextFunction } from 'express';
import {
  adminAuth,
  getConfiguredAdminEmails,
  getConfiguredAdminUids,
} from '../lib/firebase-admin';
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

function isTokenOrEnvAdmin(decoded: {
  uid: string;
  email?: string;
  email_verified?: boolean;
  admin?: unknown;
  role?: unknown;
}): boolean {
  if (decoded.admin === true || decoded.role === 'Admin') {
    return true;
  }
  const adminUids = getConfiguredAdminUids();
  if (adminUids.includes(decoded.uid)) {
    return true;
  }
  const email = (decoded.email || '').toLowerCase();
  if (email && Boolean(decoded.email_verified)) {
    const adminEmails = getConfiguredAdminEmails();
    if (adminEmails.includes(email)) {
      return true;
    }
  }
  return false;
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
    const isAdminFromEnvOrClaim = isTokenOrEnvAdmin(decoded);

    req.idToken = token;
    req.user = {
      uid: decoded.uid,
      email,
      name: decoded.name || email.split('@')[0] || 'Student',
      avatar: decoded.picture,
      emailVerified: Boolean(decoded.email_verified),
      role: isAdminFromEnvOrClaim ? 'Admin' : 'Student',
    };

    next();
  } catch {
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
    const isAdminFromEnvOrClaim = isTokenOrEnvAdmin(decoded);

    req.idToken = token;
    req.user = {
      uid: decoded.uid,
      email,
      name: decoded.name || email.split('@')[0] || 'Student',
      avatar: decoded.picture,
      emailVerified: Boolean(decoded.email_verified),
      role: isAdminFromEnvOrClaim ? 'Admin' : 'Student',
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

  if (req.user.role === 'Admin') {
    return next();
  }

  try {
    const [adminDoc, profile] = await Promise.all([
      firestoreRest
        .getDoc<{ uid?: string; role?: string }>('admins', req.user.uid, req.idToken)
        .catch(() => null),
      firestoreRest
        .getDoc<{ role?: string }>('users', req.user.uid, req.idToken)
        .catch(() => null),
    ]);

    if (adminDoc || profile?.role === 'Admin') {
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
