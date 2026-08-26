import { Schema, model, Document } from 'mongoose';

/**
 * Worker
 * Pseudonymous worker profile. No raw PII (Aadhaar, phone, etc.) is ever
 * stored here. `id` is a human-readable pseudonymous identifier like
 * "OS-DEMO-001", not the Mongo _id.
 *
 * NOTE: monthlyIncome is intentionally NOT stored here. It is a computed
 * verification output owned by the Python Verification Engine and
 * persisted per-period in VerificationRecord. schemeController.ts should
 * read the worker's latest VerificationRecord for income, not this model,
 * so scheme matching never uses stale income data.
 *
 * Field names here (workerCategory, location) match @onshift/shared-types'
 * Worker interface. phoneHash exists in shared-types but is intentionally
 * NOT persisted here per the security doc's "no raw PII" rule, even hashed.
 */
export interface WorkerDocument extends Document {
  id: string;
  name?: string;
  phoneNumber?: string;
  email?: string;
  dateOfBirth?: string;
  gender?: string;
  state?: string;
  city?: string;
  workerCategory?: string; // e.g. "Delivery Partner", "Rideshare Driver", "Task Worker"
  location?: string; // e.g. "Mumbai, Maharashtra"
  createdAt: string;
  updatedAt: string;
}

const WorkerSchema = new Schema<WorkerDocument>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    name: {
      type: String,
      required: false,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: false,
      trim: true,
    },
    email: {
      type: String,
      required: false,
      trim: true,
    },
    dateOfBirth: {
      type: String,
      required: false,
      trim: true,
    },
    gender: {
      type: String,
      required: false,
      trim: true,
    },
    state: {
      type: String,
      required: false,
      trim: true,
    },
    city: {
      type: String,
      required: false,
      trim: true,
    },
    workerCategory: {
      type: String,
      required: false,
      trim: true,
    },
    location: {
      type: String,
      required: false,
      trim: true,
    },
  },
  {
    timestamps: true, // adds createdAt / updatedAt automatically
    versionKey: false,
  }
);

export const Worker = model<WorkerDocument>('Worker', WorkerSchema);
