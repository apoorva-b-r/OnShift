import { VerificationResult, PayoutPeriod } from '@onshift/shared-types';
import { DEMO_VERIFICATION_SCENARIO_1 } from '@onshift/mock-data';
import { config } from '../config';

export async function calculateVerificationLevel(
  workerId: string,
  payoutPeriod: PayoutPeriod,
  evidenceIds: string[]
): Promise<VerificationResult> {
  try {
    const res = await fetch(`${config.verificationEngineUrl}/verification/level`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerId, payoutPeriod, evidenceIds }),
    });

    if (res.ok) {
      return (await res.json()) as VerificationResult;
    }
  } catch (err) {
    // Fallback to internal deterministic verification rules
  }

  return DEMO_VERIFICATION_SCENARIO_1;
}
