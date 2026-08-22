/**
 * authController.ts
 *
 * POST /api/v1/auth/login  (dev/demo only)
 *
 * IMPORTANT: This is NOT production identity verification.
 * It is a convenience endpoint for hackathon demos and local development.
 * It accepts a workerId + role claim at face value and issues a short-lived JWT.
 * DigiLocker / API Setu identity verification is a SEPARATE concern.
 *
 * This endpoint is only mounted when ENABLE_AUTH=true (see routes/index.ts).
 * It is explicitly disabled in production by checking NODE_ENV and ENABLE_AUTH.
 */

import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from '../middleware/apiError';
import type { WorkerRole } from '../middleware/authMiddleware';

const VALID_ROLES: WorkerRole[] = ['WORKER', 'VERIFIER', 'ADMIN'];

function isValidRole(r: unknown): r is WorkerRole {
  return typeof r === 'string' && (VALID_ROLES as string[]).includes(r);
}

/**
 * POST /api/v1/auth/login
 *
 * Body: { workerId: string, role?: 'WORKER' | 'VERIFIER' | 'ADMIN' }
 * Returns: { token: string, expiresIn: string, workerId: string, role: string }
 *
 * The returned JWT contains:
 *   sub  = workerId  (the canonical identity claim — all auth derives from this)
 *   role = role      (authorization level)
 *   iat / exp        (standard claims)
 *
 * Token lifetime: 24h (for demo convenience — use shorter in production).
 */
export const login = async (req: Request, res: Response) => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim() === '') {
    throw new ApiError(500, 'INTERNAL_SERVER_ERROR', 'Authentication service unavailable.');
  }

  const { workerId, role: rawRole } = req.body;

  if (typeof workerId !== 'string' || !workerId.trim()) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'workerId is required and must be a non-empty string.');
  }

  const role: WorkerRole = isValidRole(rawRole) ? rawRole : 'WORKER';

  const token = jwt.sign(
    {
      sub: workerId.trim(),
      role,
    },
    secret,
    {
      algorithm: 'HS256',
      expiresIn: '24h',
    }
  );

  return res.status(200).json({
    token,
    expiresIn: '24h',
    workerId: workerId.trim(),
    role,
    _warning:
      'DEV/DEMO ONLY. This endpoint issues tokens without external identity verification. ' +
      'DigiLocker / API Setu identity verification is a separate concern.',
  });
};
