import { Request, Response } from 'express';
import { runReconciliation } from '../services/reconciliationService';
import { ApiError } from '../middleware/apiError';

export const executeReconciliation = async (req: Request, res: Response) => {
  const authWorkerId = req.user?.workerId;
  if (!authWorkerId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authenticated worker identity required.');
  }

  if (req.body?.workerId && req.body.workerId !== authWorkerId) {
    throw new ApiError(
      403,
      'WORKER_ID_MISMATCH',
      `Authenticated identity (${authWorkerId}) does not match request workerId (${req.body.workerId}).`
    );
  }

  const { payoutPeriod, evidenceIds, scenarioMode, evidences } = req.body;
  const result = await runReconciliation(
    authWorkerId,
    payoutPeriod || { startDate: '2026-08-01', endDate: '2026-08-07' },
    evidenceIds || [],
    scenarioMode || 'SCENARIO_1',
    evidences
  );
  return res.json(result);
};
