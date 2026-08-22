import { Request, Response } from 'express';
import { runReconciliation } from '../services/reconciliationService';
import { getEffectiveWorkerId } from '../middleware/authMiddleware';

export const executeReconciliation = async (req: Request, res: Response) => {
  const workerId = getEffectiveWorkerId(req);

  const { payoutPeriod, evidenceIds, scenarioMode, evidences } = req.body;
  const result = await runReconciliation(
    workerId,
    payoutPeriod || { startDate: '2026-08-01', endDate: '2026-08-07' },
    evidenceIds || [],
    scenarioMode || 'SCENARIO_1',
    evidences
  );
  return res.json(result);
};
