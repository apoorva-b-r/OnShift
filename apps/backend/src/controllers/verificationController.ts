import { Request, Response } from 'express';
import { calculateVerificationLevel, runAuthoritativeVerificationPipeline } from '../services/verificationService';
import { ApiError } from '../middleware/apiError';

export const runVerification = async (req: Request, res: Response) => {
  const workerId = req.user?.workerId || req.body?.workerId;
  if (!workerId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authenticated worker ID is required.');
  }

  const payoutPeriod = req.body?.payoutPeriod || { startDate: '2026-08-01', endDate: '2026-08-07' };
  const evidenceIds = req.body?.evidenceIds;

  const record = await runAuthoritativeVerificationPipeline(workerId, payoutPeriod, evidenceIds);
  return res.status(200).json(record);
};

export const getVerificationLevel = async (req: Request, res: Response) => {
  const workerId = req.user?.workerId || req.body?.workerId || 'OS-DEMO-001';
  const { payoutPeriod, evidenceIds, evidences } = req.body;
  const result = await calculateVerificationLevel(
    workerId,
    payoutPeriod || { startDate: '2026-08-01', endDate: '2026-08-07' },
    evidenceIds || [],
    evidences
  );
  return res.json(result);
};
