import { Schema, model, Document } from 'mongoose';

/**
 * IdentityVerification
 * Mongoose schema for tracking Setu DigiLocker identity verification requests
 * and status for pseudonymous workers.
 *
 * SECURITY INVARIANT:
 * No raw Aadhaar numbers, raw Aadhaar XML documents, Setu credentials, or
 * unhashed Aadhaar PII are ever persisted in this model.
 */
export type IdentityVerificationStatus =
  | 'NOT_STARTED'
  | 'REQUEST_CREATED'
  | 'AUTHENTICATED'
  | 'VERIFIED'
  | 'FAILED'
  | 'EXPIRED'
  | 'REVOKED';

export const IDENTITY_VERIFICATION_STATUSES: IdentityVerificationStatus[] = [
  'NOT_STARTED',
  'REQUEST_CREATED',
  'AUTHENTICATED',
  'VERIFIED',
  'FAILED',
  'EXPIRED',
  'REVOKED',
];

export interface IdentityVerificationDocument extends Document {
  workerId: string;
  provider: string; // e.g., 'SETU_DIGILOCKER'
  requestId?: string; // Setu DigiLocker request ID (e.g. from POST /api/digilocker)
  status: IdentityVerificationStatus;
  validUpto?: Date;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const IdentityVerificationSchema = new Schema<IdentityVerificationDocument>(
  {
    workerId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    provider: {
      type: String,
      required: true,
      default: 'SETU_DIGILOCKER',
      trim: true,
    },
    requestId: {
      type: String,
      required: false,
      index: true,
      trim: true,
    },
    status: {
      type: String,
      required: true,
      enum: IDENTITY_VERIFICATION_STATUSES,
      default: 'NOT_STARTED',
    },
    validUpto: {
      type: Date,
      required: false,
    },
    verifiedAt: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const IdentityVerification = model<IdentityVerificationDocument>(
  'IdentityVerification',
  IdentityVerificationSchema
);
