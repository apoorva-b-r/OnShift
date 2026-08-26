import { Request, Response, NextFunction, RequestHandler } from 'express';
import crypto from 'crypto';
import { ApiError } from './apiError';

export type WorkerRole = 'WORKER' | string;

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

/** Read JWT secret at call-time so test overrides of process.env.JWT_SECRET take effect. */
function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'onshift_default_jwt_secret_key_2026_dev_demo_only';
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

/**
 * Generate a HMAC-SHA256 JWT token for a given workerId.
 */
export function generateWorkerToken(workerId: string, expiresInMs = 86400000, role: WorkerRole = 'WORKER'): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Date.now();
  const payload = {
    sub: workerId,
    workerId,
    role,
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

/**
 * Verify HMAC-SHA256 JWT token from Authorization header.
 */
export function verifyWorkerToken(token: string): AuthenticatedUser {
  if (!token || typeof token !== 'string') {
    throw new ApiError(401, 'UNAUTHORIZED', 'Missing Authorization header or token.');
  }

  if (!token.match(/^Bearer\s+/i)) {
    throw new ApiError(401, 'INVALID_TOKEN', 'Missing Authorization Bearer scheme.');
  }

  const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
  if (!cleanToken) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Missing Authorization header or token.');
  }

  const parts = cleanToken.split('.');
  if (parts.length !== 3) {
    throw new ApiError(401, 'INVALID_TOKEN', 'Malformed token format.');
  }

  const [encodedHeader, encodedPayload, signature] = parts;

  let header: any;
  try {
    header = JSON.parse(base64UrlDecode(encodedHeader));
  } catch (_) {
    throw new ApiError(401, 'INVALID_TOKEN', 'Malformed token header.');
  }

  if (!header || header.alg !== 'HS256') {
    throw new ApiError(401, 'INVALID_TOKEN', 'Unapproved or missing signing algorithm.');
  }

  const data = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = crypto
    .createHmac('sha256', getJwtSecret())
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (signature !== expectedSignature) {
    throw new ApiError(401, 'INVALID_TOKEN', 'Token signature verification failed.');
  }

  let payload: any;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch (_) {
    throw new ApiError(401, 'INVALID_TOKEN', 'Failed to decode token payload.');
  }

  if (payload.exp && Date.now() / 1000 > payload.exp) {
    throw new ApiError(401, 'EXPIRED_TOKEN', 'Authentication token has expired.');
  }

  const sub = payload.sub;
  if (!sub || typeof sub !== 'string' || !sub.trim()) {
    throw new ApiError(401, 'INVALID_TOKEN', 'Token missing or invalid sub claim.');
  }

  // Normalise role to WORKER
  const role = 'WORKER';

  return { workerId: sub, role };
}

/**
 * Express Middleware: Enforces authentication and extracts worker identity strictly from JWT sub.
 */
export const authenticateWorker: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'Missing Authorization header or token.'));
  }

  try {
    const user = verifyWorkerToken(authHeader);
    req.user = user;

    // Explicit worker-ID field mismatch checks against authenticated req.user.workerId
    const suppliedWorkerIds: (string | undefined)[] = [
      req.body?.workerId,
      req.params?.workerId,
      typeof req.query?.workerId === 'string' ? req.query.workerId : undefined,
    ];

    for (const suppliedId of suppliedWorkerIds) {
      if (suppliedId !== undefined && suppliedId !== user.workerId) {
        return next(
          new ApiError(
            403,
            'WORKER_ID_MISMATCH',
            `Authenticated identity (${user.workerId}) does not match requested workerId (${suppliedId}).`
          )
        );
      }
    }

    return next();
  } catch (err) {
    return next(err);
  }
};

/**
 * Role Guard Middleware: Requires specified role on authenticated user.
 */
export const requireRole = (requiredRole: string): RequestHandler => (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'Authentication required.'));
  }
  if (req.user.role !== requiredRole) {
    return next(new ApiError(403, 'FORBIDDEN_ROLE', `Role ${requiredRole} is required.`));
  }
  return next();
};
