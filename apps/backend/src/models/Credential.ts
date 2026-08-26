import { Schema, model, Document } from 'mongoose';
import type { CredentialClaim } from '@onshift/shared-types';

export interface CredentialDocument extends Document {
  type: string;
  credentialType?: string;
  issuer: string;
  issuerPublicKey?: string;
  publicKeyHex?: string;
  workerId: string;
  verificationId?: string;
  issuedAt: string;
  validUntil: string;
  claims: CredentialClaim;
  signature: string;
}

const CredentialSchema = new Schema<CredentialDocument>(
  {
    type: {
      type: String,
      required: true,
      default: 'OnShiftIncomeCredential',
    },
    credentialType: {
      type: String,
      required: false,
    },
    issuer: {
      type: String,
      required: true,
      default: 'OnShift Proof Authority',
    },
    issuerPublicKey: {
      type: String,
      required: false,
    },
    publicKeyHex: {
      type: String,
      required: true,
    },
    workerId: {
      type: String,
      required: true,
      index: true,
    },
    verificationId: {
      type: String,
      required: false,
      index: true,
    },
    issuedAt: {
      type: String,
      required: true,
    },
    validUntil: {
      type: String,
      required: true,
    },
    claims: {
      verifiedIncome: { type: Number, required: true },
      period: { type: String, required: true },
      verificationLevel: {
        type: String,
        required: true,
        enum: ['DECLARED', 'OBSERVED', 'CORROBORATED', 'FINANCIALLY_CORROBORATED'],
      },
      platformBreakdown: { type: Schema.Types.Mixed, required: false },
      identityVerified: { type: Boolean, required: false },
    },
    signature: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Enforce idempotency: A worker can only have one credential issued per verificationId
CredentialSchema.index({ workerId: 1, verificationId: 1 }, { unique: true, sparse: true });

export const Credential = model<CredentialDocument>('Credential', CredentialSchema);

