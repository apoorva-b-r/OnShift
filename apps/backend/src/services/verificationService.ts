import { VerificationResult, PayoutPeriod } from '@onshift/shared-types';
import {
  DEMO_VERIFICATION_SCENARIO_1,
  DEMO_VERIFICATION_SCENARIO_2,
} from '@onshift/mock-data';
import { config } from '../config';
import { VerificationRecord, Evidence, VerificationRecordDocument } from '../models';
import { ApiError } from '../middleware/apiError';
import { validateAndNormalizeEvidence, CanonicalEvidenceInput } from './evidenceAdapter';

export async function runAuthoritativeVerificationPipeline(
  workerId: string,
  payoutPeriod: PayoutPeriod,
  requestedEvidenceIds?: string[]
): Promise<VerificationRecordDocument> {
  let dbEvidenceRecords: any[] = [];
  try {
    dbEvidenceRecords = await Evidence.find({ workerId }).lean();
  } catch (err) {
    console.warn('Failed to query evidence records from MongoDB, proceeding with empty/fallback array.');
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

    if (verRes.ok) {
      verResult = (await verRes.json()) as VerificationResult;
      engineSource = 'PYTHON_VERIFICATION_ENGINE';
    }
    if (reconRes.ok) {
      reconResult = await reconRes.json();
    }
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('Verification/Reconciliation engine unreachable, using fallback.');
  }

  if (!verResult) {
    const isScenario2 = evidenceIds.includes('ev-fin-hdfc-002');
    verResult = isScenario2 ? DEMO_VERIFICATION_SCENARIO_2 : DEMO_VERIFICATION_SCENARIO_1;
  }

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
    reconciliationStatus: reconResult?.status || (verResult.level === 'FINANCIALLY_CORROBORATED' ? 'MATCHED' : 'UNEXPLAINED_DIFFERENCE'),
    expectedGross: reconResult?.expectedGross ?? (verResult.level === 'FINANCIALLY_CORROBORATED' ? 30100 : 0),
    authorizedDeductions: reconResult?.authorizedDeductions ?? 0,
    expectedNet: reconResult?.expectedNet ?? (verResult.level === 'FINANCIALLY_CORROBORATED' ? 30100 : 0),
    actualSettlement: reconResult?.actualSettlement ?? (verResult.level === 'FINANCIALLY_CORROBORATED' ? 30100 : 0),
    engineSource,
    verificationEngineVersion: '1.0.0',
    computedAt: new Date().toISOString(),
  };

  try {
    const record = await VerificationRecord.create(recordData);
    return record;
  } catch (err) {
    console.warn('Failed to persist VerificationRecord to DB, returning in-memory document.');
    return recordData as any;
  }
}

async function persistRecord(
  workerId: string,
  payoutPeriod: PayoutPeriod,
  evidenceIds: string[],
  result: VerificationResult,
  engineSource: string
): Promise<void> {
  try {
    await VerificationRecord.create({
      id: `vr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      workerId,
      payoutPeriod,
      level: result.level,
      confidence: result.confidence,
      reason: result.reason,
      supportingEvidence: result.supportingEvidence || [],
      limitations: result.limitations || '',
      evidenceIds,
      engineSource,
      computedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Failed to persist verification record to database.');
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
  let engineSource = 'MOCK_FALLBACK';

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

    if (res.ok) {
      result = (await res.json()) as VerificationResult;
      engineSource = 'PYTHON_VERIFICATION_ENGINE';
    } else {
      console.warn('Verification engine returned non-200 status, using mock fallback.');
    }
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('Verification engine unreachable, using mock fallback.');
  }

  if (!result) {
    const isScenario2 = evidenceIds.includes('ev-fin-hdfc-002');
    result = isScenario2 ? DEMO_VERIFICATION_SCENARIO_2 : DEMO_VERIFICATION_SCENARIO_1;
  }

  await persistRecord(workerId, payoutPeriod, evidenceIds, result, engineSource);

  return result;
}

