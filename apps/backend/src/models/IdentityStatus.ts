/**
 * IdentityStatus.ts
 *
 * Models identity verification status as a concept SEPARATE from JWT auth.
 *
 * JWT auth  = "Is this session authorised to act as worker X?" (authMiddleware.ts)
 * DigiLocker/API Setu = "Has worker X's identity been externally verified?" (here)
 *
 * These two concerns must never be conflated. A worker can hold a valid JWT
 * (session is authenticated) while still having IdentityVerificationStatus=UNVERIFIED
 * (their real-world identity has not yet been confirmed by an external provider).
 *
 * This file provides the type model only. Actual DigiLocker / API Setu integration
 * is out of scope for this auth hardening task and should not be faked here.
 */

/** Who performed the identity verification. */
export type IdentityProvider =
  | 'DEMO'          // Hackathon placeholder — no real verification performed
  | 'API_SETU'      // Setu's Account Aggregator / DigiLocker sandbox
  | 'DIGILOCKER';   // Government of India DigiLocker (production)

/** Whether the worker's identity has been verified by an external provider. */
export type IdentityVerificationStatus = 'UNVERIFIED' | 'VERIFIED';

/**
 * IdentityVerificationRecord
 *
 * Represents the result of an identity verification attempt for a single worker.
 * This is a separate record from the JWT token and from the Worker model.
 */
export interface IdentityVerificationRecord {
  workerId: string;
  status: IdentityVerificationStatus;
  provider: IdentityProvider;
  verifiedAt?: string;   // ISO 8601 timestamp, absent if UNVERIFIED
  expiresAt?: string;    // ISO 8601 timestamp, absent if no expiry
}
