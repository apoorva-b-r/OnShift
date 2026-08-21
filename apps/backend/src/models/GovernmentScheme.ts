import { Schema, model, Document } from 'mongoose';

/**
 * GovernmentScheme
 * Structured catalog entry for a government benefit/loan/pension scheme
 * (e.g. PM SVANidhi, e-Shram). Used by the deterministic eligibility
 * filter BEFORE anything is passed to the Nemotron Ultra 3 AI layer
 * (owned by Member 6 / Surbhi). Field-for-field match with shared-types'
 * GovernmentScheme interface, so no import/type adjustment was needed here.
 */
export interface GovernmentSchemeDocument extends Document {
  id: string;
  name: string;
  description: string;
  targetWorkerTypes: string[];
  minMonthlyIncome?: number;
  maxMonthlyIncome?: number;
  eligibilityRules: string[];
  documents: string[];
  applicationUrl: string;
  status: 'ACTIVE' | 'UPCOMING';
}

const GovernmentSchemeSchema = new Schema<GovernmentSchemeDocument>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    targetWorkerTypes: {
      type: [String],
      required: true,
      default: [],
    },
    minMonthlyIncome: {
      type: Number,
      required: false,
    },
    maxMonthlyIncome: {
      type: Number,
      required: false,
    },
    eligibilityRules: {
      type: [String],
      required: true,
      default: [],
    },
    documents: {
      type: [String],
      required: true,
      default: [],
    },
    applicationUrl: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['ACTIVE', 'UPCOMING'],
      default: 'ACTIVE',
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

export const GovernmentScheme = model<GovernmentSchemeDocument>(
  'GovernmentScheme',
  GovernmentSchemeSchema
);
