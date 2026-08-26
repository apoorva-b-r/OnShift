import { VerificationResult, PayoutPeriod } from '@onshift/shared-types';
import {
  DEMO_VERIFICATION_SCENARIO_1,
  DEMO_VERIFICATION_SCENARIO_2,
} from '@onshift/mock-data';
import { config } from '../config';
import { VerificationRecord, Evidence, VerificationRecordDocument } from '../models';
import { ApiError } from '../middleware/apiError';
import { validateAndNormalizeEvidence, CanonicalEvidenceInput } from './evidenceAdapter';
import { isIdentityVerified } from './identityGate';


export async function runAuthoritativeVerificationPipeline(
  workerId: string,
  payoutPeriod: PayoutPeriod,
  requestedEvidenceIds?: string[]
): Promise<VerificationRecordDocument> {
  let dbEvidenceRecords: any[] = [];
  try {
    dbEvidenceRecords = await Evidence.find({ workerId }).lean();
  } catch (err) {
    throw new ApiError(503, 'VERIFICATION_DATABASE_UNAVAILABLE', 'Verification evidence is temporarily unavailable.');
  }

  // Validate ownership if specific evidenceIds were requested
  if (requestedEvidenceIds && requestedEvidenceIds.length > 0) {
    const dbIds = new Set(dbEvidenceRecords.map((e) => e.id));
    for (const reqId of requestedEvidenceIds) {
      if (!dbIds.has(reqId)) {
        // Check if evidence exists under a different worker
        let otherWorkerRecord = null;
        try {
          otherWorkerRecord = await Evidence.findOne({ id: reqId }).lean();
        } catch (_) {}
        if (otherWorkerRecord && otherWorkerRecord.workerId !== workerId) {
          throw new ApiError(
            403,
            'FORBIDDEN_EVIDENCE_ACCESS',
            `Requested evidence ID ${reqId} does not belong to the authenticated worker.`
          );
        }
      }
    }
  }

  // Filter evidence to requested set or all evidence for worker
  const selectedEvidence =
    requestedEvidenceIds && requestedEvidenceIds.length > 0
      ? dbEvidenceRecords.filter((e) => requestedEvidenceIds.includes(e.id))
      : dbEvidenceRecords;

  const normalizedEvidences: CanonicalEvidenceInput[] = selectedEvidence.map(validateAndNormalizeEvidence);
  const evidenceIds = selectedEvidence.map((e) => e.id);

  if (selectedEvidence.length === 0) {
    if (!config.demoMode) {
      throw new ApiError(422, 'INSUFFICIENT_EVIDENCE', 'No real evidence is available for verification.');
    }
    // In demo mode, proceed with empty evidence set; engine fallback will supply fixture result.
  }

  // Call Python verification level & reconciliation engine
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  let verResult: VerificationResult | null = null;
  let reconResult: any = null;
  let engineSource = 'MOCK_FALLBACK';

  try {
    const [verRes, reconRes] = await Promise.all([
      fetch(`${config.verificationEngineUrl}/verification/level`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId,
          payoutPeriod,
          evidenceIds,
          evidences: normalizedEvidences,
        }),
        signal: controller.signal,
      }),
      fetch(`${config.verificationEngineUrl}/reconciliation/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId,
          payoutPeriod,
          evidenceIds,
          evidences: normalizedEvidences,
        }),
        signal: controller.signal,
      }),
    ]);
    clearTimeout(timeoutId);

    if (!verRes.ok || !reconRes.ok) {
      throw new Error('Authoritative verification engine returned a non-success response.');
    }
    verResult = (await verRes.json()) as VerificationResult;
    reconResult = await reconRes.json();
    if (
      !verResult ||
      !['DECLARED', 'OBSERVED', 'CORROBORATED', 'FINANCIALLY_CORROBORATED'].includes(verResult.level) ||
      typeof verResult.confidence !== 'number' ||
      !verResult.reason ||
      !reconResult ||
      typeof reconResult.status !== 'string'
    ) {
      throw new Error('Authoritative verification engine returned an invalid result.');
    }
    engineSource = 'PYTHON_VERIFICATION_ENGINE';
  } catch (err) {
    clearTimeout(timeoutId);
    if (!config.demoMode) {
      throw new ApiError(503, 'VERIFICATION_SERVICE_UNAVAILABLE', 'Authoritative verification service is unavailable.');
    }
    console.warn('Verification engine unavailable; explicit demo mode is enabled.');
  }

  if (!verResult) {
    if (!config.demoMode) {
      throw new ApiError(503, 'VERIFICATION_SERVICE_UNAVAILABLE', 'Authoritative verification result is unavailable.');
    }
    const isScenario2 = evidenceIds.includes('ev-fin-hdfc-002');
    verResult = isScenario2 ? DEMO_VERIFICATION_SCENARIO_2 : DEMO_VERIFICATION_SCENARIO_1;
    reconResult = reconResult || {};
    engineSource = 'MOCK_FALLBACK';
  }

  const idVerified = await isIdentityVerified(workerId);
  const verificationId = `vr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const recordData = {
    id: verificationId,
    workerId,
    payoutPeriod,
    level: verResult.level,
    confidence: verResult.confidence,
    reason: verResult.reason,
    supportingEvidence: verResult.supportingEvidence || [],
    limitations: verResult.limitations || '',
    evidenceIds,
    identityVerified: idVerified,
    reconciliationStatus: reconResult?.status || (verResult.level === 'FINANCIALLY_CORROBORATED' ? 'MATCHED' : 'UNEXPLAINED_DIFFERENCE'),
    expectedGross: reconResult?.expectedGross ?? (verResult.level === 'FINANCIALLY_CORROBORATED' ? 30100 : 0),
    authorizedDeductions: reconResult?.authorizedDeductions ?? 0,
    expectedNet: reconResult?.expectedNet ?? (verResult.level === 'FINANCIALLY_CORROBORATED' ? 30100 : 0),
    actualSettlement: reconResult?.actualSettlement ?? (verResult.level === 'FINANCIALLY_CORROBORATED' ? 30100 : 0),
    engineSource,
    verificationSource: engineSource === 'PYTHON_VERIFICATION_ENGINE' ? 'AUTHORITATIVE_ENGINE' : 'DEMO_FIXTURE',
    verificationEngineVersion: '1.0.0',
    computedAt: new Date().toISOString(),
  };

  try {
    const record = await VerificationRecord.create(recordData);
    return record;
  } catch (err) {
    throw new ApiError(503, 'VERIFICATION_DATABASE_UNAVAILABLE', 'Verification result could not be persisted.');
  }
}

export async function calculateVerificationLevel(
  workerId: string,
  payoutPeriod: PayoutPeriod,
  evidenceIds: string[],
  evidences?: any[]
): Promise<VerificationResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  let normalizedEvidences: CanonicalEvidenceInput[] | undefined = undefined;
  if (evidences && Array.isArray(evidences)) {
    normalizedEvidences = evidences.map(validateAndNormalizeEvidence);
  }

  let result: VerificationResult | null = null;
  try {
    const res = await fetch(`${config.verificationEngineUrl}/verification/level`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workerId,
        payoutPeriod,
        evidenceIds,
        evidences: normalizedEvidences,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error('Verification engine returned a non-success response.');
    }
    result = (await res.json()) as VerificationResult;
    if (
      !result ||
      !['DECLARED', 'OBSERVED', 'CORROBORATED', 'FINANCIALLY_CORROBORATED'].includes(result.level) ||
      typeof result.confidence !== 'number' ||
      !result.reason
    ) {
      throw new Error('Verification engine returned an invalid result.');
    }
  } catch (err) {
    clearTimeout(timeoutId);
    if (!config.demoMode) {
      throw new ApiError(503, 'VERIFICATION_SERVICE_UNAVAILABLE', 'Authoritative verification service is unavailable.');
    }
    console.warn('Verification engine unavailable; explicit demo mode is enabled.');
  }

  if (!result) {
    if (!config.demoMode) {
      throw new ApiError(503, 'VERIFICATION_SERVICE_UNAVAILABLE', 'Authoritative verification result is unavailable.');
    }
    const isScenario2 = evidenceIds.includes('ev-fin-hdfc-002');
    result = isScenario2 ? DEMO_VERIFICATION_SCENARIO_2 : DEMO_VERIFICATION_SCENARIO_1;
  }

  return result;
}

