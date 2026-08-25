import { Schema, model, Document } from 'mongoose';
import type { VerificationLevel } from '@onshift/shared-types';

/**
 * VerificationRecord
 * A persisted snapshot of a VerificationResult returned by the Python
 * Verification Engine (owned by Member 2 / Apoorva) for a given worker
 * and payout period. The Python engine remains the single source of
 * truth for WHAT the result is; this collection exists only to remember
 * that result after the fact, since a Credential only ever stores the
 * bare `verificationLevel` claim and drops confidence/reason/limitations.
 *
 * This model is written to (not computed from) inside verificationService.ts
 * immediately after a successful response from the Python engine. It is
 * never used to decide or override a verification level.
 *
 * VerificationLevel is imported from @onshift/shared-types rather than
 * redeclared locally, so this file can never silently drift from the
 * canonical enum used across Android, backend, and verifier-web.
 */
export interface PayoutPeriod {
  startDate: string;
  endDate: string;
}

export interface VerificationRecordDocument extends Document {
  id: string;
  workerId: string;
  payoutPeriod: PayoutPeriod;
  level: VerificationLevel;
  confidence: number;
  reason: string;
  supportingEvidence: string[];
  limitations: string;
  evidenceIds: string[]; // the exact evidenceIds sent in the originating request
  identityVerified?: boolean;
  reconciliationStatus?: string; // MATCHED | EXPLAINED_DIFFERENCE | UNEXPLAINED_DIFFERENCE | INSUFFICIENT_EVIDENCE
  expectedGross?: number;
  authorizedDeductions?: number;
  expectedNet?: number;
  actualSettlement?: number;
  engineSource: string; // e.g. "PYTHON_VERIFICATION_ENGINE" or "MOCK_FALLBACK"
  verificationEngineVersion?: string;
  computedAt: string;
}

const PayoutPeriodSchema = new Schema<PayoutPeriod>(
  {
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
  },
  { _id: false } // embedded sub-document, no separate _id needed
);

const VerificationRecordSchema = new Schema<VerificationRecordDocument>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    workerId: {
      type: String,
      required: true,
      index: true,
    },
    payoutPeriod: {
      type: PayoutPeriodSchema,
      required: true,
    },
    level: {
      type: String,
      required: true,
      enum: ['DECLARED', 'OBSERVED', 'CORROBORATED', 'FINANCIALLY_CORROBORATED'],
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    reason: {
      type: String,
      required: true,
    },
    supportingEvidence: {
      type: [String],
      required: true,
      default: [],
    },
    limitations: {
      type: String,
      required: true,
    },
    evidenceIds: {
      type: [String],
      required: true,
      default: [],
    },
    identityVerified: {
      type: Boolean,
      required: false,
      default: false,
    },
    reconciliationStatus: {
      type: String,
      required: false,
    },
    expectedGross: {
      type: Number,
      required: false,
    },
    authorizedDeductions: {
      type: Number,
      required: false,
    },
    expectedNet: {
      type: Number,
      required: false,
    },
    actualSettlement: {
      type: Number,
      required: false,
    },
    engineSource: {
      type: String,
      required: true,
      default: 'PYTHON_VERIFICATION_ENGINE',
    },
    verificationEngineVersion: {
      type: String,
      required: false,
      default: '1.0.0',
    },
    computedAt: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: false, // computedAt is the canonical timestamp
    versionKey: false,
  }
);

// Fast lookup: "give me this worker's verification history, most recent first"
VerificationRecordSchema.index({ workerId: 1, computedAt: -1 });

export const VerificationRecord = model<VerificationRecordDocument>(
  'VerificationRecord',
  VerificationRecordSchema
);
