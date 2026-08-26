import { ReconciliationResult, PayoutPeriod } from '@onshift/shared-types';
import { DEMO_RECONCILIATION_SCENARIO_1, DEMO_RECONCILIATION_SCENARIO_2 } from '@onshift/mock-data';
import { config } from '../config';
import { Evidence } from '../models';
import { ApiError } from '../middleware/apiError';
import { validateAndNormalizeEvidence, CanonicalEvidenceInput } from './evidenceAdapter';

export async function runReconciliation(
  workerId: string,
  payoutPeriod: PayoutPeriod,
  evidenceIds: string[],
  scenarioMode: string = 'SCENARIO_1',
  evidences?: any[]
): Promise<ReconciliationResult> {
  if (evidenceIds && evidenceIds.length > 0) {
    try {
      const forbiddenDoc = await Evidence.findOne({
        id: { $in: evidenceIds },
        workerId: { $ne: workerId },
      }).lean();
      if (forbiddenDoc) {
        throw new ApiError(
          403,
          'FORBIDDEN_EVIDENCE_ACCESS',
          `Evidence ID ${forbiddenDoc.id} belongs to worker ${forbiddenDoc.workerId}, not authenticated worker ${workerId}.`
        );
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(503, 'RECONCILIATION_DATABASE_UNAVAILABLE', 'Reconciliation evidence is temporarily unavailable.');
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  let normalizedEvidences: CanonicalEvidenceInput[] | undefined;
  if (evidences && Array.isArray(evidences)) {
    normalizedEvidences = evidences.map(validateAndNormalizeEvidence);
  }

  let result: ReconciliationResult | null = null;
  try {
    const res = await fetch(`${config.verificationEngineUrl}/reconciliation/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerId, payoutPeriod, evidenceIds, evidences: normalizedEvidences, scenarioMode }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error('Reconciliation engine returned a non-success response.');
    result = await res.json();
    if (!result || typeof result.status !== 'string') {
      throw new Error('Reconciliation engine returned an invalid result.');
    }
  } catch (err) {
    clearTimeout(timeoutId);
    if (!config.demoMode) {
      throw new ApiError(503, 'RECONCILIATION_SERVICE_UNAVAILABLE', 'Authoritative reconciliation service is unavailable.');
    }
    console.warn('Reconciliation engine unavailable; explicit demo mode is enabled.');
  }

  if (!result) {
    if (!config.demoMode) {
      throw new ApiError(503, 'RECONCILIATION_SERVICE_UNAVAILABLE', 'Authoritative reconciliation result is unavailable.');
    }
    const isScenario2 = scenarioMode === 'SCENARIO_2' || evidenceIds.includes('ev-fin-hdfc-002');
    result = isScenario2 ? DEMO_RECONCILIATION_SCENARIO_2 : DEMO_RECONCILIATION_SCENARIO_1;
  }

  return result;
}
