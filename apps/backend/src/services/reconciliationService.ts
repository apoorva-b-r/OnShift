import { ReconciliationResult, PayoutPeriod } from '@onshift/shared-types';
import { DEMO_RECONCILIATION_SCENARIO_1, DEMO_RECONCILIATION_SCENARIO_2 } from '@onshift/mock-data';
import { config } from '../config';
import { validateAndNormalizeEvidence, CanonicalEvidenceInput } from './evidenceAdapter';

export async function runReconciliation(
  workerId: string,
  payoutPeriod: PayoutPeriod,
  evidenceIds: string[],
  scenarioMode: string = 'SCENARIO_1',
  evidences?: any[]
): Promise<ReconciliationResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  let normalizedEvidences: CanonicalEvidenceInput[] | undefined = undefined;
  if (evidences && Array.isArray(evidences)) {
    normalizedEvidences = evidences.map(validateAndNormalizeEvidence);
  }

  let result: ReconciliationResult | null = null;

  try {
    const res = await fetch(`${config.verificationEngineUrl}/reconciliation/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workerId,
        payoutPeriod,
        evidenceIds,
        evidences: normalizedEvidences,
        scenarioMode,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      result = (await res.json()) as ReconciliationResult;
    } else {
      console.warn('Reconciliation engine returned non-200 status, using mock fallback.');
    }
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('Reconciliation engine unreachable, using mock fallback.');
  }

  if (!result) {
    const isScenario2 = scenarioMode === 'SCENARIO_2' || evidenceIds.includes('ev-fin-hdfc-002');
    result = isScenario2 ? DEMO_RECONCILIATION_SCENARIO_2 : DEMO_RECONCILIATION_SCENARIO_1;
  }

  return result;
}

