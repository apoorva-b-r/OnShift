import { Request, Response } from 'express';
import { runReconciliation } from '../services/reconciliationService';

export const executeReconciliation = async (req: Request, res: Response) => {
  const { workerId, payoutPeriod, evidenceIds, scenarioMode, evidences } = req.body;
  const result = await runReconciliation(
    workerId || 'OS-DEMO-001',
    payoutPeriod || { startDate: '2026-08-01', endDate: '2026-08-07' },
    evidenceIds || [],
    scenarioMode || 'SCENARIO_1',
    evidences
  );
  return res.json(result);
};
