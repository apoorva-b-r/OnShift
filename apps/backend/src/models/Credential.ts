import { Schema, model, Document } from 'mongoose';
import type { CredentialClaim } from '@onshift/shared-types';

/**
 * Credential
 * A signed, portable OnShiftIncomeCredential as issued by
 * credentialService.ts (which wraps Member 5 / Nidhi's Ed25519 signing
 * helpers from @onshift/credential-schema). Stored so it can be re-fetched
 * or audited, but the source of truth for validity is always the
 * signature itself, verified independently by the Verifier Web App.
 *
 * `claims` uses shared-types' CredentialClaim directly (not a locally
 * redeclared version) because credential-schema/src/index.ts imports
 * CredentialClaim from @onshift/shared-types and passes it straight into
 * signCredential/verifyCredentialSignature. A locally-diverged shape here
 * (e.g. optional fields, a renamed `breakdown` vs `platformBreakdown`)
 * would break that call or silently drop data.
 */
export interface CredentialDocument extends Document {
  type: string;
  issuer: string;
  publicKeyHex: string;
  workerId: string;
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
    issuer: {
      type: String,
      required: true,
      default: 'OnShift Proof Authority',
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
    },
    signature: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: false, // issuedAt is the canonical timestamp
    versionKey: false,
  }
);

export const Credential = model<CredentialDocument>('Credential', CredentialSchema);
