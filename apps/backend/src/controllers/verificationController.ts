import { Request, Response } from 'express';
import { calculateVerificationLevel, runAuthoritativeVerificationPipeline } from '../services/verificationService';
import { ApiError } from '../middleware/apiError';

export const runVerification = async (req: Request, res: Response) => {
  const authWorkerId = req.user?.workerId;
  if (!authWorkerId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authenticated worker ID is required.');
  }

  if (req.body?.workerId && req.body.workerId !== authWorkerId) {
    throw new ApiError(
      403,
      'WORKER_ID_MISMATCH',
      `Authenticated identity (${authWorkerId}) does not match requested workerId (${req.body.workerId}).`
    );
  }

  const payoutPeriod = req.body?.payoutPeriod || { startDate: '2026-08-01', endDate: '2026-08-07' };
  const evidenceIds = req.body?.evidenceIds;

  const record = await runAuthoritativeVerificationPipeline(authWorkerId, payoutPeriod, evidenceIds);
  return res.status(200).json(record);
};

export const getVerificationLevel = async (req: Request, res: Response) => {
  const authWorkerId = req.user?.workerId;
  if (!authWorkerId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authenticated worker ID is required.');
  }

  if (req.body?.workerId && req.body.workerId !== authWorkerId) {
    throw new ApiError(
      403,
      'WORKER_ID_MISMATCH',
      `Authenticated identity (${authWorkerId}) does not match requested workerId (${req.body.workerId}).`
    );
  }

  const { payoutPeriod, evidenceIds, evidences } = req.body;
  const result = await calculateVerificationLevel(
    authWorkerId,
    payoutPeriod || { startDate: '2026-08-01', endDate: '2026-08-07' },
    evidenceIds || [],
    evidences
  );
  return res.json(result);
};
