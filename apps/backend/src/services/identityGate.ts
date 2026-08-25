import { IdentityVerification } from '../models/IdentityVerification';
import { ApiError } from '../middleware/apiError';

/**
 * Check if a worker's DigiLocker identity is verified in MongoDB.
 * MongoDB is the single source of truth for identity verification status.
 */
export async function isIdentityVerified(workerId: string): Promise<boolean> {
  if (!workerId || typeof workerId !== 'string' || !workerId.trim()) {
    return false;
  }
  try {
    const record = await IdentityVerification.findOne({ workerId: workerId.trim() }).lean();
    return record?.status === 'VERIFIED';
  } catch (_) {
    return false;
  }
}

/**
 * Server-side Identity Gate.
 * Enforces that DigiLocker identity verification (status === 'VERIFIED') has been
 * completed for the given workerId.
 *
 * Throws 403 IDENTITY_VERIFICATION_REQUIRED if identity is missing, pending, or revoked.
 *
 * SECURITY INVARIANTS:
 * 1. Derived strictly from MongoDB IdentityVerification collection.
 * 2. Never trusts req.body.identityVerified or client input.
 * 3. Never infers identity verification from client headers or JWT claims.
 */
export async function requireIdentityVerification(workerId: string): Promise<void> {
  const verified = await isIdentityVerified(workerId);
  if (!verified) {
    throw new ApiError(
      403,
      'IDENTITY_VERIFICATION_REQUIRED',
      'DigiLocker identity verification is required before this operation.'
    );
  }
}
