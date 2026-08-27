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
import mongoose from 'mongoose';
import { ApiError } from '../middleware/apiError';
import type { WorkerRole } from '../middleware/authMiddleware';
import { config } from '../config';
import { Worker } from '../models/Worker';

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
  const secret = process.env.JWT_SECRET || config.jwtSecret;
  if (!secret || secret.trim() === '') {
    throw new ApiError(500, 'INTERNAL_SERVER_ERROR', 'Authentication service unavailable.');
  }

  const body = req.body || {};
  const { workerId, role: rawRole } = body;

  if (typeof workerId !== 'string' || !workerId.trim()) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'workerId is required and must be a non-empty string.');
  }

  const role: WorkerRole = isValidRole(rawRole) ? rawRole : 'WORKER';
  const cleanWorkerId = workerId.trim();
  let canonicalWorkerId = cleanWorkerId;

  // Persist / upsert Worker document in MongoDB if database connection is active
  if (mongoose.connection.readyState === 1) {
    try {
      const { name, phoneNumber, email, dateOfBirth, gender, state, city, workerCategory } = body;
      const targetEmail = typeof email === 'string' && email.trim() ? email.trim() : (cleanWorkerId.includes('@') ? cleanWorkerId : undefined);
      const targetPhone = typeof phoneNumber === 'string' && phoneNumber.trim() ? phoneNumber.trim() : undefined;

      // Find existing worker by ID, Email, or Phone in MongoDB workers collection
      const searchCriteria: any[] = [{ id: cleanWorkerId }];
      if (targetEmail) searchCriteria.push({ email: targetEmail });
      if (targetPhone) searchCriteria.push({ phoneNumber: targetPhone });

      let existingWorker = await Worker.findOne({ $or: searchCriteria });

      if (existingWorker) {
        canonicalWorkerId = existingWorker.id;
        const setPayload: Record<string, any> = {};
        if (typeof name === 'string' && name.trim()) setPayload.name = name.trim();
        if (typeof phoneNumber === 'string' && phoneNumber.trim()) setPayload.phoneNumber = phoneNumber.trim();
        if (targetEmail && !existingWorker.email) setPayload.email = targetEmail;
        if (typeof dateOfBirth === 'string' && dateOfBirth.trim()) setPayload.dateOfBirth = dateOfBirth.trim();
        if (typeof gender === 'string' && gender.trim()) setPayload.gender = gender.trim();
        if (typeof state === 'string' && state.trim()) setPayload.state = state.trim();
        if (typeof city === 'string' && city.trim()) setPayload.city = city.trim();
        if (typeof workerCategory === 'string' && workerCategory.trim()) setPayload.workerCategory = workerCategory.trim();
        if (typeof city === 'string' && city.trim() && typeof state === 'string' && state.trim()) {
          setPayload.location = `${city.trim()}, ${state.trim()}`;
        }

        if (Object.keys(setPayload).length > 0) {
          await Worker.updateOne({ _id: existingWorker._id }, { $set: setPayload });
        }
        console.log(`[Auth] Updated existing MongoDB Worker document for ${canonicalWorkerId}`);
      } else {
        // Create new Worker document in MongoDB workers collection
        const newId = cleanWorkerId.startsWith('OS-') ? cleanWorkerId : `OS-${Math.abs(cleanWorkerId.split('').reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0))}`;
        canonicalWorkerId = newId;

        const defaultName = typeof name === 'string' && name.trim() ? name.trim() : (cleanWorkerId.includes('@') ? cleanWorkerId.split('@')[0] : `Worker ${newId}`);
        const defaultLocation = (typeof city === 'string' && city.trim() && typeof state === 'string' && state.trim()) ? `${city.trim()}, ${state.trim()}` : undefined;

        await Worker.create({
          id: newId,
          name: defaultName,
          email: targetEmail,
          phoneNumber: targetPhone,
          dateOfBirth: typeof dateOfBirth === 'string' && dateOfBirth.trim() ? dateOfBirth.trim() : undefined,
          gender: typeof gender === 'string' && gender.trim() ? gender.trim() : undefined,
          state: typeof state === 'string' && state.trim() ? state.trim() : undefined,
          city: typeof city === 'string' && city.trim() ? city.trim() : undefined,
          workerCategory: typeof workerCategory === 'string' && workerCategory.trim() ? workerCategory.trim() : 'Delivery Partner',
          location: defaultLocation,
        });
        console.log(`[Auth] Created new MongoDB Worker document for ${newId} (${targetEmail || cleanWorkerId})`);
      }
    } catch (err) {
      console.warn(`[Auth] Note: MongoDB Worker persistence for ${cleanWorkerId}:`, err);
    }
  }

  let workerDoc: any = null;
  if (mongoose.connection.readyState === 1) {
    try {
      workerDoc = await Worker.findOne({ id: canonicalWorkerId }).lean();
    } catch (_e) {}
  }

  if (!workerDoc) {
    workerDoc = {
      id: canonicalWorkerId,
      name: body.name || (cleanWorkerId.includes('@') ? cleanWorkerId.split('@')[0] : 'Sadhana R Somaiya'),
      email: body.email || (cleanWorkerId.includes('@') ? cleanWorkerId : 'sadhana.r@somaiya.edu'),
      phoneNumber: body.phoneNumber || '+91 98765 43210',
      dateOfBirth: body.dateOfBirth || '1998-05-15',
      gender: body.gender || 'Female',
      state: body.state || 'Maharashtra',
      city: body.city || 'Mumbai',
      workerCategory: body.workerCategory || 'Delivery Partner',
    };
  }

  const token = jwt.sign(
    {
      sub: canonicalWorkerId,
      role,
      iss: 'onshift',
      identityVerified: false,
    },
    secret,
    {
      algorithm: 'HS256',
      expiresIn: (process.env.JWT_EXPIRES_IN as any) || '24h',
    }
  );

  return res.status(200).json({
    token,
    expiresIn: '24h',
    workerId: canonicalWorkerId,
    role,
    worker: {
      id: workerDoc.id || canonicalWorkerId,
      name: workerDoc.name,
      email: workerDoc.email,
      phoneNumber: workerDoc.phoneNumber,
      dateOfBirth: workerDoc.dateOfBirth,
      gender: workerDoc.gender,
      state: workerDoc.state,
      city: workerDoc.city,
      workerCategory: workerDoc.workerCategory,
    },
    _warning:
      'DEV/DEMO ONLY. This endpoint issues tokens without external identity verification. ' +
      'DigiLocker / API Setu identity verification is a separate concern.',
  });
};
