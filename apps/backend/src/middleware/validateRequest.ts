import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ApiError, ValidationDetail } from './apiError';

type RequestValidator = (body: unknown) => ValidationDetail[];

const evidenceSources = new Set(['DECLARED', 'OBSERVED', 'FINANCIAL']);
const verificationLevels = new Set([
  'DECLARED',
  'OBSERVED',
  'CORROBORATED',
  'FINANCIALLY_CORROBORATED',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(body: Record<string, unknown>, field: string, details: ValidationDetail[]) {
  if (typeof body[field] !== 'string' || !body[field].trim()) {
    details.push({ field, issue: 'Required non-empty string.' });
  }
}

function optionalString(body: Record<string, unknown>, field: string, details: ValidationDetail[]) {
  if (body[field] !== undefined && (typeof body[field] !== 'string' || !body[field].trim())) {
    details.push({ field, issue: 'Must be a non-empty string when provided.' });
  }
}

function isoDate(value: unknown): boolean {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function requestBody(body: unknown, details: ValidationDetail[]): Record<string, unknown> | null {
  if (!isRecord(body)) {
    details.push({ field: 'body', issue: 'Must be a JSON object.' });
    return null;
  }
  return body;
}

function validatePayoutRequest(body: unknown): ValidationDetail[] {
  const details: ValidationDetail[] = [];
  const data = requestBody(body, details);
  if (!data) return details;

  requiredString(data, 'workerId', details);
  if (!Array.isArray(data.evidenceIds) || data.evidenceIds.length === 0 || !data.evidenceIds.every((id) => typeof id === 'string' && id.trim())) {
    details.push({ field: 'evidenceIds', issue: 'Must contain at least one non-empty evidence ID.' });
  }
  if (!isRecord(data.payoutPeriod) || !isoDate(data.payoutPeriod.startDate) || !isoDate(data.payoutPeriod.endDate)) {
    details.push({ field: 'payoutPeriod', issue: 'Must include valid startDate and endDate values.' });
  } else if (Date.parse(data.payoutPeriod.startDate as string) > Date.parse(data.payoutPeriod.endDate as string)) {
    details.push({ field: 'payoutPeriod', issue: 'startDate must not be after endDate.' });
  }
  return details;
}

export const validateRequest = (validator: RequestValidator): RequestHandler => (req, _res, next) => {
  const details = validator(req.body);
  if (details.length > 0) {
    return next(new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed.', details));
  }
  return next();
};

export const validateWorker: RequestValidator = (body) => {
  const details: ValidationDetail[] = [];
  const data = requestBody(body, details);
  if (!data) return details;
  optionalString(data, 'id', details);
  optionalString(data, 'name', details);
  optionalString(data, 'workerCategory', details);
  optionalString(data, 'location', details);
  return details;
};

export const validateEvidence: RequestValidator = (body) => {
  const details: ValidationDetail[] = [];
  const data = requestBody(body, details);
  if (!data) return details;

  requiredString(data, 'workerId', details);
  requiredString(data, 'source', details);
  if (typeof data.source === 'string' && !evidenceSources.has(data.source)) {
    details.push({ field: 'source', issue: 'Must be DECLARED, OBSERVED, or FINANCIAL.' });
  }
  for (const field of ['type', 'platform', 'currency', 'reference', 'previousHash', 'integrityHash']) {
    requiredString(data, field, details);
  }
  if (typeof data.amount !== 'number' || !Number.isFinite(data.amount) || data.amount < 0) {
    details.push({ field: 'amount', issue: 'Must be a non-negative number.' });
  }
  for (const field of ['timestamp', 'capturedAt']) {
    if (!isoDate(data[field])) {
      details.push({ field, issue: 'Must be a valid ISO date.' });
    }
  }
  return details;
};

export const validateReconciliation = validatePayoutRequest;
export const validateVerification = validatePayoutRequest;

export const validateCredentialIssue: RequestValidator = (body) => {
  const details: ValidationDetail[] = [];
  const data = requestBody(body, details);
  if (!data) return details;

  requiredString(data, 'workerId', details);
  if (!isRecord(data.disclosedClaims)) {
    details.push({ field: 'disclosedClaims', issue: 'Must be an object.' });
    return details;
  }
  if (typeof data.disclosedClaims.verifiedIncome !== 'number' || data.disclosedClaims.verifiedIncome < 0) {
    details.push({ field: 'disclosedClaims.verifiedIncome', issue: 'Must be a non-negative number.' });
  }
  requiredString(data.disclosedClaims, 'period', details);
  if (typeof data.disclosedClaims.verificationLevel !== 'string' || !verificationLevels.has(data.disclosedClaims.verificationLevel)) {
    details.push({ field: 'disclosedClaims.verificationLevel', issue: 'Must be a valid verification level.' });
  }
  return details;
};

export const validateCredentialVerify: RequestValidator = (body) => {
  const details: ValidationDetail[] = [];
  const data = requestBody(body, details);
  if (!data) return details;

  for (const field of ['credentialType', 'issuer', 'issuerPublicKey', 'workerId', 'issuedAt', 'validUntil', 'signature']) {
    requiredString(data, field, details);
  }
  if (!isRecord(data.claims)) {
    details.push({ field: 'claims', issue: 'Must be an object.' });
  }
  return details;
};

export const validateSchemeMatch: RequestValidator = (body) => {
  const details: ValidationDetail[] = [];
  const data = requestBody(body, details);
  if (!data) return details;

  if (data.monthlyIncome !== undefined && (typeof data.monthlyIncome !== 'number' || data.monthlyIncome < 0)) {
    details.push({ field: 'monthlyIncome', issue: 'Must be a non-negative number.' });
  }
  optionalString(data, 'workerCategory', details);
  optionalString(data, 'location', details);
  return details;
};

export const validateConsentRequest: RequestValidator = (body) => {
  const details: ValidationDetail[] = [];
  const data = requestBody(body, details);
  if (!data) return details;

  requiredString(data, 'workerId', details);
  optionalString(data, 'aaProvider', details);
  return details;
};
