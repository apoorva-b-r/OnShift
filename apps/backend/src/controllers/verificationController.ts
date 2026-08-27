import { Request, Response } from 'express';
import { calculateVerificationLevel, runAuthoritativeVerificationPipeline } from '../services/verificationService';
import { ApiError } from '../middleware/apiError';

export const runVerification = async (req: Request, res: Response) => {
  const authWorkerId = req.user?.workerId;
  if (!authWorkerId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authenticated worker ID is required.');
  }

  const targetWorkerId = authWorkerId;
  const payoutPeriod = req.body?.payoutPeriod || { startDate: '2026-08-01', endDate: '2026-08-07' };
  const evidenceIds = req.body?.evidenceIds;

  const record = await runAuthoritativeVerificationPipeline(targetWorkerId, payoutPeriod, evidenceIds);
  const jsonRecord = (record as any).toJSON ? (record as any).toJSON() : record;
  return res.status(200).json({
    ...jsonRecord,
    verificationId: jsonRecord.id || (record as any).id || (record as any)._id?.toString(),
    id: jsonRecord.id || (record as any).id || (record as any)._id?.toString(),
  });
};

export const getVerificationLevel = async (req: Request, res: Response) => {
  const authWorkerId = req.user?.workerId;
  if (!authWorkerId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authenticated worker ID is required.');
  }

  const targetWorkerId = authWorkerId;

  const { payoutPeriod, evidenceIds, evidences } = req.body;
  const result = await calculateVerificationLevel(
    authWorkerId,
    payoutPeriod || { startDate: '2026-08-01', endDate: '2026-08-07' },
    evidenceIds || [],
    evidences
  );
  return res.json(result);
};
