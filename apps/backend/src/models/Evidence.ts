import { Schema, model, Document } from 'mongoose';

export interface IEvidenceDocument extends Document {
  id: string;
  workerId: string;
  source: string;
  type: string;
  platform: string;
  timestamp: Date;
  amount: number;
  currency: string;
  reference: string;
  metadata?: Record<string, any>;
  capturedAt: Date;
  previousHash: string;
  integrityHash: string;
}

const EvidenceSchema = new Schema<IEvidenceDocument>(
  {
    id: { type: String, required: true, unique: true, index: true },
    workerId: { type: String, required: true, index: true },
    source: { type: String, required: true }, // DECLARED, OBSERVED, FINANCIAL
    type: { type: String, required: true },
    platform: { type: String, required: true },
    timestamp: { type: Date, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    reference: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
    capturedAt: { type: Date, default: Date.now },
    previousHash: { type: String, required: true },
    integrityHash: { type: String, required: true },
  },
  { timestamps: true }
);

export const EvidenceModel = model<IEvidenceDocument>('Evidence', EvidenceSchema);
