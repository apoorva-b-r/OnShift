import { Schema, model, Document } from 'mongoose';

export interface IGovernmentSchemeDocument extends Document {
  id: string;
  name: string;
  description: string;
  targetWorkerTypes: string[];
  minMonthlyIncome?: number;
  maxMonthlyIncome?: number;
  eligibilityRules: string[];
  documents: string[];
  applicationUrl: string;
  status: string;
}

const GovernmentSchemeSchema = new Schema<IGovernmentSchemeDocument>(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    targetWorkerTypes: [{ type: String }],
    minMonthlyIncome: { type: Number },
    maxMonthlyIncome: { type: Number },
    eligibilityRules: [{ type: String }],
    documents: [{ type: String }],
    applicationUrl: { type: String, required: true },
    status: { type: String, default: 'ACTIVE' },
  },
  { timestamps: true }
);

export const GovernmentSchemeModel = model<IGovernmentSchemeDocument>('GovernmentScheme', GovernmentSchemeSchema);
