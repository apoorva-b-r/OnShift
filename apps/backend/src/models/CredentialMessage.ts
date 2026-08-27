import { Schema, model, Document } from 'mongoose';

export interface CredentialAttachment {
  fileName: string;
  mimeType: string;
  content: Record<string, any>;
}

export interface CredentialMessageDocument extends Document {
  messageId: string;
  workerId: string;
  credentialId: string;
  title: string;
  body: string;
  verificationUrl: string;
  attachments: CredentialAttachment[];
  createdAt: string;
}

const CredentialMessageSchema = new Schema<CredentialMessageDocument>(
  {
    messageId: { type: String, required: true, unique: true, index: true },
    workerId: { type: String, required: true, index: true },
    credentialId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    verificationUrl: { type: String, required: true },
    attachments: [
      {
        fileName: { type: String, required: true },
        mimeType: { type: String, required: true },
        content: { type: Schema.Types.Mixed, required: true },
      },
    ],
    createdAt: { type: String, required: true, default: () => new Date().toISOString() },
  },
  { timestamps: false, versionKey: false }
);

export const CredentialMessage = model<CredentialMessageDocument>(
  'CredentialMessage',
  CredentialMessageSchema
);
