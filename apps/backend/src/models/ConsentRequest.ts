import { Schema, model, Document } from 'mongoose';

export interface IConsentRequestDocument extends Document {
  consentId: string;
  workerId: string;
  aaProvider: string;
  status: string;
  authorizationUrl: string;
}

const ConsentRequestSchema = new Schema<IConsentRequestDocument>(
  {
    consentId: { type: String, required: true, unique: true, index: true },
    workerId: { type: String, required: true, index: true },
    aaProvider: { type: String, required: true },
    status: { type: String, default: 'PENDING' },
    authorizationUrl: { type: String, required: true },
  },
  { timestamps: true }
);

export const ConsentRequestModel = model<IConsentRequestDocument>('ConsentRequest', ConsentRequestSchema);
