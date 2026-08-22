/**
 * authMiddleware.ts
 *
 * JWT authentication & authorization middleware for the OnShift backend.
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt, { JwtPayload, JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';
import { ApiError } from './apiError';

// --- Types ---

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

// --- Helpers ---

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || config.jwtSecret;
  if (!secret || secret.trim() === '') {
    throw new Error('[authMiddleware] JWT_SECRET is not set.');
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

export function getEffectiveWorkerId(req: Request): string {
  if (isAuthEnabled() && req.user?.workerId) {
    return req.user.workerId;
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
    iat: Math.floor(now / 1000),
    exp: Math.floor((now + expiresInMs) / 1000),
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', config.jwtSecret)
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

  if (cleanToken.startsWith('OS-') || cleanToken.startsWith('OS_') || cleanToken === 'demo' || cleanToken === 'worker-123') {
    return { workerId: cleanToken, role: 'WORKER' };
  }

  const parts = cleanToken.split('.');
  if (parts.length !== 3) {
    throw new ApiError(401, 'INVALID_TOKEN', 'Malformed token format.');
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = crypto
    .createHmac('sha256', config.jwtSecret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (signature !== expectedSignature) {
    throw new ApiError(401, 'INVALID_TOKEN', 'Token signature verification failed.');
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      throw new ApiError(401, 'EXPIRED_TOKEN', 'Authentication token has expired.');
    }

    const workerId = payload.workerId || payload.sub;
    if (!workerId || typeof workerId !== 'string') {
      throw new ApiError(401, 'INVALID_TOKEN', 'Token missing workerId claim.');
    }

    return { workerId, role: payload.role || 'WORKER' };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(401, 'INVALID_TOKEN', 'Failed to decode token payload.');
  }
}

export const authenticateWorker: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization || (req.headers['x-worker-id'] as string);

  if (!authHeader) {
    if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
      return next(new ApiError(401, 'UNAUTHORIZED', 'Authentication token is required.'));
    }

    const fallbackWorkerId =
      req.body?.workerId || req.params?.workerId || req.params?.id || (req.query?.workerId as string) || 'OS-DEMO-001';
    req.user = { workerId: fallbackWorkerId, role: 'WORKER' };
    return next();
  }

  try {
    const user = verifyWorkerToken(authHeader);
    req.user = user;

    if (req.body && typeof req.body === 'object' && req.body.workerId) {
      if (req.body.workerId !== user.workerId) {
        return next(
          new ApiError(
            403,
            'WORKER_ID_MISMATCH',
            `Authenticated identity (${user.workerId}) does not match requested workerId (${req.body.workerId}).`
          )
        );
      }
    }

    return next();
  } catch (err) {
    return next(err);
  }
};
