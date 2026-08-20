import {
  ReconciliationResult,
  PayoutPeriod,
} from '@onshift/shared-types';
import {
  DEMO_RECONCILIATION_SCENARIO_1,
  DEMO_RECONCILIATION_SCENARIO_2,
} from '@onshift/mock-data';
import { config } from '../config';

export async function runReconciliation(
  workerId: string,
  payoutPeriod: PayoutPeriod,
  evidenceIds: string[],
  scenarioMode: string = 'SCENARIO_1'
): Promise<ReconciliationResult> {
  // If verification engine service is live, try proxying request
  try {
    const res = await fetch(`${config.verificationEngineUrl}/reconciliation/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerId, payoutPeriod, evidenceIds, scenarioMode }),
    });

    if (res.ok) {
      return (await res.json()) as ReconciliationResult;
    }
  } catch (err) {
    // Fallback to deterministic mock logic for offline hackathon robustness
  }

  if (scenarioMode === 'SCENARIO_2' || evidenceIds.includes('ev-fin-hdfc-002')) {
    return DEMO_RECONCILIATION_SCENARIO_2;
  }

  return DEMO_RECONCILIATION_SCENARIO_1;
}
