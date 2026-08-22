/**
 * authMiddleware.ts
 *
 * JWT authentication & authorization middleware for the OnShift backend.
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt, { JwtPayload, JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { ApiError } from './apiError';

// --- Types ---

export type WorkerRole = 'WORKER' | 'VERIFIER' | 'ADMIN';

export interface AuthenticatedUser {
  workerId: string;
  role: WorkerRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

// --- Helpers ---

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim() === '') {
    throw new Error('[authMiddleware] JWT_SECRET is not set. Set JWT_SECRET in your environment.');
  }
  return secret;
}

function isValidRole(role: unknown): role is WorkerRole {
  return role === 'WORKER' || role === 'VERIFIER' || role === 'ADMIN';
}

const AUTH_BYPASS_WORKER: AuthenticatedUser = {
  workerId: 'OS-DEMO-001',
  role: 'WORKER',
};

export function isAuthEnabled(): boolean {
  if (process.env.ENABLE_AUTH === 'false') return false;
  if (process.env.ENABLE_AUTH === 'true') return true;
  return process.env.NODE_ENV !== 'test';
}

/**
 * Helper for controllers:
 * When auth is enabled, derives workerId strictly from the verified JWT (req.user.workerId).
 * When auth is disabled (legacy test mode), uses body/params/query workerId if present.
 */
export function getEffectiveWorkerId(req: Request): string {
  if (isAuthEnabled()) {
    return req.user?.workerId || 'OS-DEMO-001';
  }
  return req.body?.workerId || req.params?.workerId || (req.query?.workerId as string) || req.user?.workerId || 'OS-DEMO-001';
}

// --- Core authenticate middleware ---

export const authenticate: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  if (!isAuthEnabled()) {
    req.user = AUTH_BYPASS_WORKER;
    return next();
  }

  const authHeader = req.headers['authorization'];

  if (!authHeader || typeof authHeader !== 'string') {
    return next(new ApiError(401, 'UNAUTHORIZED', 'Missing Authorization header.'));
  }

  if (!authHeader.startsWith('Bearer ')) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'Authorization header must use Bearer scheme.'));
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'Bearer token is empty.'));
  }

  let secret: string;
  try {
    secret = getJwtSecret();
  } catch (err) {
    console.error((err as Error).message);
    return next(new ApiError(500, 'INTERNAL_SERVER_ERROR', 'Authentication service unavailable.'));
  }

  let payload: JwtPayload;
  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (typeof decoded === 'string' || !decoded) {
      return next(new ApiError(401, 'UNAUTHORIZED', 'Malformed token payload.'));
    }
    payload = decoded as JwtPayload;
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      return next(new ApiError(401, 'TOKEN_EXPIRED', 'JWT has expired.'));
    }
    if (err instanceof JsonWebTokenError) {
      return next(new ApiError(401, 'UNAUTHORIZED', 'Invalid JWT signature or format.'));
    }
    return next(new ApiError(401, 'UNAUTHORIZED', 'Token verification failed.'));
  }

  const sub = payload.sub;
  const role = payload.role;

  if (typeof sub !== 'string' || !sub.trim()) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'JWT missing required claim: sub.'));
  }
  if (!isValidRole(role)) {
    return next(
      new ApiError(403, 'FORBIDDEN', `JWT claim role must be WORKER, VERIFIER, or ADMIN. Got: ${role}`)
    );
  }

  req.user = { workerId: sub, role };
  return next();
};

// --- Authorization helpers ---

export const requireRole = (...allowedRoles: WorkerRole[]): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!isAuthEnabled()) {
      return next();
    }
    if (!req.user) {
      return next(new ApiError(401, 'UNAUTHORIZED', 'Authentication required.'));
    }
    const { role } = req.user;
    if (role === 'ADMIN' || allowedRoles.includes(role)) {
      return next();
    }
    return next(
      new ApiError(
        403,
        'FORBIDDEN',
        `Role '${role}' is not permitted. Required: ${allowedRoles.join(' or ')}.`
      )
    );
  };
};

export const enforceWorkerOwnership: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  if (!isAuthEnabled()) {
    return next();
  }
  if (!req.user) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'Authentication required.'));
  }

  const { workerId: tokenWorkerId, role } = req.user;

  if (role === 'ADMIN') {
    return next();
  }

  if (req.body && typeof req.body.workerId === 'string') {
    if (req.body.workerId !== tokenWorkerId) {
      return next(
        new ApiError(
          403,
          'FORBIDDEN',
          `workerId in request body ('${req.body.workerId}') does not match authenticated worker ('${tokenWorkerId}').`
        )
      );
    }
  }

  if (req.params && typeof req.params.workerId === 'string') {
    if (req.params.workerId !== tokenWorkerId) {
      return next(
        new ApiError(
          403,
          'FORBIDDEN',
          `workerId in URL ('${req.params.workerId}') does not match authenticated worker ('${tokenWorkerId}').`
        )
      );
    }
  }

  if (req.query && typeof req.query.workerId === 'string') {
    if (req.query.workerId !== tokenWorkerId) {
      return next(new ApiError(403, 'FORBIDDEN', 'workerId in query string does not match authenticated worker.'));
    }
  }

  return next();
};
