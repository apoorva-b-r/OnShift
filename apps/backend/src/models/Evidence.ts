import { Schema, model, Document } from 'mongoose';
import type { EvidenceSource } from '@onshift/shared-types';

/**
 * Evidence
 * A single piece of proof: a declared claim, an observed platform
 * notification, or a financial (AA) settlement record. Records form a
 * tamper-evident hash chain per worker via previousHash / integrityHash,
 * computed on-device by Member 4 (Aanya) and stored here as-is.
 *
 * shared-types models Evidence as a discriminated union (DeclaredEvidence /
 * ObservedEvidence / FinancialEvidence), each with source-specific fields
 * (declaredNotes, packageName/rawTextSnippet, bankName/accountMask/
 * transactionRef). This schema flattens that union into one collection but
 * mirrors every one of those fields as optional top-level fields, so a
 * FinancialEvidence payload's bankName/accountMask/transactionRef (etc.)
 * is never silently dropped on save. Controllers should read/write these
 * fields directly rather than stuffing source-specific data into
 * `metadata`, which is reserved for genuinely unstructured extras.
 */
export interface EvidenceDocument extends Document {
  id: string;
  workerId: string;
  source: EvidenceSource;
  type: string; // e.g. ORDER_PAYOUT, BANK_SETTLEMENT, SELF_REPORT
  platform: string; // e.g. Zomato, Swiggy, Uber, HDFC Bank
  timestamp: string;
  amount: number;
  currency: string;
  reference: string;
  metadata: Record<string, unknown>;
  capturedAt: string;
  previousHash: string;
  integrityHash: string;

  // Source-specific optional fields (mirrors shared-types' Evidence union)
  declaredNotes?: string; // DeclaredEvidence only
  packageName?: string; // ObservedEvidence only
  rawTextSnippet?: string; // ObservedEvidence only
  bankName?: string; // FinancialEvidence only
  accountMask?: string; // FinancialEvidence only
  transactionRef?: string; // FinancialEvidence only
}

const EvidenceSchema = new Schema<EvidenceDocument>(
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
    source: {
      type: String,
      required: true,
      enum: ['DECLARED', 'OBSERVED', 'FINANCIAL'],
    },
    type: {
      type: String,
      required: true,
    },
    platform: {
      type: String,
      required: true,
    },
    timestamp: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
      default: 'INR',
    },
    reference: {
      type: String,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    capturedAt: {
      type: String,
      required: true,
    },
    previousHash: {
      type: String,
      required: true,
    },
    integrityHash: {
      type: String,
      required: true,
    },
    declaredNotes: {
      type: String,
      required: false,
    },
    packageName: {
      type: String,
      required: false,
    },
    rawTextSnippet: {
      type: String,
      required: false,
    },
    bankName: {
      type: String,
      required: false,
    },
    accountMask: {
      type: String,
      required: false,
    },
    transactionRef: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: false, // capturedAt/timestamp are the source of truth, not Mongo's own timestamps
    versionKey: false,
  }
);

// Fast lookups: "all evidence for worker X, in chain order"
EvidenceSchema.index({ workerId: 1, capturedAt: 1 });

export const Evidence = model<EvidenceDocument>('Evidence', EvidenceSchema);
