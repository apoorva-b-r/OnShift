import { Schema, model, Document } from 'mongoose';

/**
 * ConsentRequest
 * Tracks Account Aggregator (AA) consent requests initiated by a worker
 * to link bank/financial data. Works against either a real Setu/Sahamati
 * sandbox or Member 5's MockAccountAggregatorProvider, both of which must
 * populate this schema identically per the AA Checkpoint rule. No
 * equivalent exists in shared-types (this is a backend-only persistence/
 * audit model), so no cross-type import is needed here.
 */
export type ConsentStatus = 'PENDING' | 'ACTIVE' | 'REVOKED' | 'EXPIRED';

export interface ConsentRequestDocument extends Document {
  consentId: string;
  workerId: string;
  fiTypes: string[]; // e.g. ['DEPOSIT']
  status: ConsentStatus;
  consentUrl?: string;
  isMock: boolean; // true when served by MockAccountAggregatorProvider
  fipId?: string;
  approvedAt?: Date | string;
  expiresAt?: Date | string;
  createdAt: string;
  updatedAt: string;
}

const ConsentRequestSchema = new Schema<ConsentRequestDocument>(
  {
    consentId: {
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
    fiTypes: {
      type: [String],
      required: true,
      default: ['DEPOSIT'],
    },
    status: {
      type: String,
      required: true,
      enum: ['PENDING', 'ACTIVE', 'REVOKED', 'EXPIRED'],
      default: 'PENDING',
    },
    consentUrl: {
      type: String,
      required: false,
    },
    isMock: {
      type: Boolean,
      required: true,
      default: true, // explicitly labeled, per credential/AA mock rule
    },
    fipId: {
      type: String,
      required: false,
    },
    approvedAt: {
      type: Date,
      required: false,
    },
    expiresAt: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: true, // createdAt / updatedAt
    versionKey: false,
  }
);

export const ConsentRequest = model<ConsentRequestDocument>(
  'ConsentRequest',
  ConsentRequestSchema
);
