import { Request, Response } from 'express';
import { calculateVerificationLevel } from '../services/verificationService';

export const getVerificationLevel = async (req: Request, res: Response) => {
  const { workerId, payoutPeriod, evidenceIds } = req.body;
  const result = await calculateVerificationLevel(
    workerId || 'OS-DEMO-001',
    payoutPeriod || { startDate: '2026-08-01', endDate: '2026-08-07' },
    evidenceIds || []
  );
  return res.json(result);
};
