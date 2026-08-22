import { Request, Response } from 'express';
import { calculateVerificationLevel } from '../services/verificationService';
import { getEffectiveWorkerId } from '../middleware/authMiddleware';

export const getVerificationLevel = async (req: Request, res: Response) => {
  const workerId = getEffectiveWorkerId(req);

  const { payoutPeriod, evidenceIds, evidences } = req.body;
  const result = await calculateVerificationLevel(
    workerId,
    payoutPeriod || { startDate: '2026-08-01', endDate: '2026-08-07' },
    evidenceIds || [],
    evidences
  );
  return res.json(result);
};
