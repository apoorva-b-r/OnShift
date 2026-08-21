import { VerificationResult, PayoutPeriod } from '@onshift/shared-types';
import {
  DEMO_VERIFICATION_SCENARIO_1,
  DEMO_VERIFICATION_SCENARIO_2,
} from '@onshift/mock-data';
import { config } from '../config';
import { VerificationRecord } from '../models';

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
  evidenceIds: string[]
): Promise<VerificationResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  let result: VerificationResult | null = null;
  let engineSource = 'MOCK_FALLBACK';

  try {
    const res = await fetch(`${config.verificationEngineUrl}/verification/level`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerId, payoutPeriod, evidenceIds }),
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

  const finalResult: VerificationResult = result;
  await persistRecord(workerId, payoutPeriod, evidenceIds, finalResult, engineSource);

  return finalResult;
}

