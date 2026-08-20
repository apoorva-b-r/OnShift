import { Schema, model, Document } from 'mongoose';

export interface ICredentialDocument extends Document {
  id: string;
  credentialType: string;
  issuer: string;
  issuerPublicKey: string;
  workerId: string;
  issuedAt: Date;
  validUntil: Date;
  claims: Record<string, any>;
  signature: string;
}

const CredentialSchema = new Schema<ICredentialDocument>(
  {
    id: { type: String, required: true, unique: true, index: true },
    credentialType: { type: String, default: 'OnShiftIncomeCredential' },
    issuer: { type: String, required: true },
    issuerPublicKey: { type: String, required: true },
    workerId: { type: String, required: true, index: true },
    issuedAt: { type: Date, default: Date.now },
    validUntil: { type: Date, required: true },
    claims: { type: Schema.Types.Mixed, required: true },
    signature: { type: String, required: true },
  },
  { timestamps: true }
);

export const CredentialModel = model<ICredentialDocument>('Credential', CredentialSchema);
