/**
 * authMiddleware.ts
 *
 * JWT authentication & authorization middleware for the OnShift backend.
 *
 * Auth is ENABLED when:
 *   - NODE_ENV !== 'test', OR
 *   - ENABLE_AUTH === 'true' (explicit opt-in even in test mode)
 *
 * Auth is DISABLED when:
 *   - NODE_ENV === 'test' AND ENABLE_AUTH is not 'true', OR
 *   - ENABLE_AUTH === 'false' (explicit opt-out)
 *
 * This preserves backward compatibility with legacy test suites (api.test.ts,
 * integration.test.ts) that do not send JWT tokens, while pipeline.test.ts
 * opts in by using generateWorkerToken() / real tokens.
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';
import { ApiError } from './apiError';

export type WorkerRole = 'WORKER' | 'VERIFIER' | 'ADMIN';

export interface AuthenticatedUser {
  workerId: string;
  role?: WorkerRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

function getJwtSecret(): string {
  return process.env.JWT_SECRET || config.jwtSecret;
}

function isValidRole(role: unknown): role is WorkerRole {
  return role === 'WORKER' || role === 'VERIFIER' || role === 'ADMIN';
}

/**
 * Returns true when JWT authentication should be enforced.
 * In test mode auth is opt-in via ENABLE_AUTH=true.
 */
export function isAuthEnabled(): boolean {
  if (process.env.ENABLE_AUTH === 'false') return false;
  if (process.env.ENABLE_AUTH === 'true') return true;
  // In test environment, auth is disabled unless ENABLE_AUTH explicitly set
  if (process.env.NODE_ENV === 'test') return false;
  return true;
}

/**
 * Returns the effective workerId for the request.
 * When auth is enabled, always uses the JWT subject.
 * When auth is disabled (test/legacy mode), falls back to body/params/query.
 */
export function getEffectiveWorkerId(req: Request): string {
  if (isAuthEnabled() && req.user?.workerId) {
    return req.user.workerId;
  }
  return (
    req.user?.workerId ||
    req.body?.workerId ||
    req.params?.workerId ||
    (req.query?.workerId as string) ||
    'OS-DEMO-001'
  );
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

export function generateWorkerToken(workerId: string, expiresInMs = 86400000): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Date.now();
  const payload = {
    sub: workerId,
    workerId,
    role: 'WORKER',
    iat: Math.floor(now / 1000),
    exp: Math.floor((now + expiresInMs) / 1000),
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', getJwtSecret())
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${data}.${signature}`;
}

export function verifyWorkerToken(token: string): AuthenticatedUser {
  if (!token || typeof token !== 'string') {
    throw new ApiError(401, 'UNAUTHORIZED', 'Missing authentication token.');
  }

  const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
  if (!cleanToken) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Bearer token is empty.');
  }

  const parts = cleanToken.split('.');
  if (parts.length !== 3) {
    throw new ApiError(401, 'INVALID_TOKEN', 'Malformed token format.');
  }

  const secret = getJwtSecret();
  let payload: any;
  try {
    const decoded = jwt.verify(cleanToken, secret, { algorithms: ['HS256'] });
    payload = typeof decoded === 'string' ? JSON.parse(decoded) : decoded;
  } catch (err: any) {
    if (err?.name === 'TokenExpiredError') {
      throw new ApiError(401, 'EXPIRED_TOKEN', 'Authentication token has expired.');
    }
    // Fallback: manual HMAC check for custom-encoded tokens
    const [encodedHeader, encodedPayload, signature] = parts;
    const data = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    if (signature !== expectedSignature) {
      throw new ApiError(401, 'INVALID_TOKEN', 'Token signature verification failed.');
    }

    try {
      payload = JSON.parse(base64UrlDecode(encodedPayload));
      if (payload.exp && Date.now() / 1000 > payload.exp) {
        throw new ApiError(401, 'EXPIRED_TOKEN', 'Authentication token has expired.');
      }
    } catch (_) {
      throw new ApiError(401, 'INVALID_TOKEN', 'Failed to decode token payload.');
    }
  }

  const workerId = payload.workerId || payload.sub;
  if (!workerId || typeof workerId !== 'string') {
    throw new ApiError(401, 'INVALID_TOKEN', 'Token missing sub or workerId claim.');
  }

  const role: WorkerRole = isValidRole(payload.role) ? payload.role : 'WORKER';
  return { workerId, role };
}

export const authenticateWorker: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization || (req.headers['x-worker-id'] as string);

  // No Authorization header provided
  if (!authHeader) {
    if (!isAuthEnabled()) {
      // Legacy / test mode: allow through, populate user from body if present
      req.user = {
        workerId: req.body?.workerId || req.params?.workerId || 'OS-DEMO-001',
        role: 'WORKER',
      };
      return next();
    }
    return next(new ApiError(401, 'UNAUTHORIZED', 'Missing Authorization header.'));
  }

  try {
    const user = verifyWorkerToken(authHeader);
    req.user = user;

    // Cross-check body workerId against JWT sub (when auth is enabled)
    if (isAuthEnabled() && req.body && typeof req.body === 'object' && req.body.workerId) {
      if (user.role !== 'ADMIN' && req.body.workerId !== user.workerId) {
        return next(
          new ApiError(
            403,
            'WORKER_ID_MISMATCH',
            `Authenticated identity (${user.workerId}) does not match requested workerId (${req.body.workerId}).`
          )
        );
      }
    }

    // Cross-check URL params workerId against JWT sub (when auth is enabled)
    if (isAuthEnabled() && req.params && typeof req.params.workerId === 'string') {
      if (user.role !== 'ADMIN' && req.params.workerId !== user.workerId) {
        return next(
          new ApiError(
            403,
            'FORBIDDEN',
            `URL workerId (${req.params.workerId}) does not match authenticated worker (${user.workerId}).`
          )
        );
      }
    }

    return next();
  } catch (err) {
    return next(err);
  }
};

export const authenticate = authenticateWorker;

export const requireRole = (...allowedRoles: WorkerRole[]): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, 'UNAUTHORIZED', 'Authentication required.'));
    }
    const role = req.user.role || 'WORKER';
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

export const enforceWorkerOwnership = authenticateWorker;
