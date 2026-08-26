import { Schema, model, Document } from 'mongoose';

/**
 * PhoneVerification
 * Mongoose schema for tracking pseudonymous phone OTP verification status
 * and attempt limits for workers.
 *
 * SECURITY INVARIANT:
 * No raw phone numbers, plaintext OTPs, OTP secrets, or unhashed PII
 * are ever persisted in this model. Only SHA-256 phoneHash and otpHash
 * are stored.
 */
export type PhoneVerificationStatus =
  | 'PENDING'
  | 'VERIFIED'
  | 'FAILED'
  | 'EXPIRED';

export const PHONE_VERIFICATION_STATUSES: PhoneVerificationStatus[] = [
  'PENDING',
  'VERIFIED',
  'FAILED',
  'EXPIRED',
];

export interface PhoneVerificationDocument extends Document {
  workerId: string;
  phoneHash: string;
  status: PhoneVerificationStatus;
  otpHash?: string;
  attempts: number;
  expiresAt?: Date;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PhoneVerificationSchema = new Schema<PhoneVerificationDocument>(
  {
    workerId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    phoneHash: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      required: true,
      enum: PHONE_VERIFICATION_STATUSES,
      default: 'PENDING',
    },
    otpHash: {
      type: String,
      required: false,
      trim: true,
    },
    attempts: {
      type: Number,
      required: true,
      default: 0,
    },
    expiresAt: {
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

export const PhoneVerification = model<PhoneVerificationDocument>(
  'PhoneVerification',
  PhoneVerificationSchema
);
