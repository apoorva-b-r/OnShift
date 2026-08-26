import { Request, Response } from 'express';
import { createHash } from 'crypto';
import mongoose from 'mongoose';
import { ConsentRequest, Evidence } from '../models';
import { ApiError } from '../middleware/apiError';
import { getAAService } from '../services/aa';

const GENESIS_HASH = 'GENESIS_0000000000000000000000000000000000000000000000000000000000000000';

function computeIntegrityHash(
  id: string,
  workerId: string,
  source: string,
  platform: string,
  amount: number,
  timestamp: string,
  previousHash: string
): string {
  const payload = `${id}|${workerId}|${source}|${platform}|${amount}|${timestamp}|${previousHash}`;
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

export const requestConsent = async (req: Request, res: Response) => {
  const authWorkerId = req.user?.workerId;
  if (!authWorkerId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authenticated worker ID is required.');
  }

  if (req.body?.workerId && req.body.workerId !== authWorkerId) {
    throw new ApiError(
      403,
      'WORKER_ID_MISMATCH',
      `Authenticated identity (${authWorkerId}) does not match request workerId (${req.body.workerId}).`
    );
  }

  const workerId = authWorkerId;
  const { fiTypes = ['DEPOSIT'] } = req.body;

  const aaService = getAAService();
  const consentResult = await aaService.createConsentRequest(workerId, fiTypes);

  return res.status(201).json({
    consentId: consentResult.consentId,
    workerId,
    fiTypes,
    status: consentResult.status,
    consentUrl: consentResult.consentUrl,
    authorizationUrl: consentResult.consentUrl,
    isMock: process.env.SETU_AA_MOCK_MODE !== 'false',
  });
};

export const getConsentStatus = async (req: Request, res: Response) => {
  const authWorkerId = req.user?.workerId;
  if (!authWorkerId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authenticated worker ID is required.');
  }

  const { consentId } = req.params;
  const aaService = getAAService();

  try {
    // Try MongoDB first
    if (mongoose.connection.readyState === 1) {
      const consent = await ConsentRequest.findOne({ consentId });
      if (consent) {
        if (consent.workerId !== authWorkerId) {
          throw new ApiError(
            403,
            'FORBIDDEN_CONSENT_ACCESS',
            `Consent request ${consentId} belongs to another worker.`
          );
        }

        // Sync status from AA service
        const statusResult = await aaService.getConsentStatus(consentId);
        if (consent.status !== statusResult.status && statusResult.status !== 'NOT_FOUND') {
          consent.status = statusResult.status as any;
          await consent.save();
        }

        return res.status(200).json({
          consentId: consent.consentId,
          workerId: consent.workerId,
          status: consent.status,
          consentUrl: consent.consentUrl,
          fipId: consent.fipId,
          approvedAt: (consent as any).approvedAt,
        });
      }
    }

    // MongoDB offline or consent not in DB — fall back to in-memory AA service
    const statusResult = await aaService.getConsentStatus(consentId);
    if (statusResult.status === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Consent request not found.' });
    }

    return res.status(200).json({
      consentId,
      workerId: authWorkerId,
      status: statusResult.status,
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    return res.status(500).json({ error: 'Failed to fetch consent status.', detail: (err as Error).message });
  }
};

export const fetchFinancialData = async (req: Request, res: Response) => {
  const authWorkerId = req.user?.workerId;
  if (!authWorkerId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authenticated worker ID is required.');
  }

  const { consentId } = req.body;
  if (!consentId) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'consentId is required.');
  }

  const consent = await ConsentRequest.findOne({ consentId, workerId: authWorkerId });
  if (!consent) {
    throw new ApiError(404, 'CONSENT_NOT_FOUND', `Consent request ${consentId} not found.`);
  }

  if (consent.status !== 'ACTIVE') {
    throw new ApiError(400, 'CONSENT_NOT_ACTIVE', `Consent ${consentId} is not in ACTIVE status.`);
  }

  const aaService = getAAService();
  const sessionResult = await aaService.createDataSession(consentId);
  const data = await aaService.getDataSession(sessionResult.sessionId);

  const accountInfo = data.account || {};
  const transactions = data.transactions || [];

  const createdEvidence: any[] = [];
  let reusedCount = 0;

  for (const txn of transactions) {
    const id = `ev-fin-${txn.transactionId || Date.now()}`;

    // Idempotency: the Mock AA returns fixed transaction IDs, so repeat demo
    // runs would collide with the unique `id` index (E11000 -> HTTP 409).
    // Reuse the previously normalized evidence instead of failing.
    const existing = await Evidence.findOne({ id }).lean();
    if (existing) {
      reusedCount += 1;
      createdEvidence.push(existing);
      continue;
    }

    const lastEvidence = await Evidence.findOne({ workerId: authWorkerId }).sort({ capturedAt: -1 }).lean();
    const previousHash = lastEvidence ? lastEvidence.integrityHash : GENESIS_HASH;

    const timestamp = new Date(txn.date || Date.now()).toISOString();
    const platform = accountInfo.fipId || 'OnShift Demo Bank';
    const amount = Number(txn.amount) || 0;
    const integrityHash = computeIntegrityHash(id, authWorkerId, 'FINANCIAL', platform, amount, timestamp, previousHash);

    const doc = await Evidence.create({
      id,
      workerId: authWorkerId,
      source: 'FINANCIAL',
      type: 'AA_BANK_SETTLEMENT',
      platform,
      bankName: platform,
      accountMask: accountInfo.maskedAccountNumber || 'XXXXXX4821',
      transactionRef: txn.transactionId,
      amount,
      currency: 'INR',
      reference: txn.transactionId ? `TXN-${txn.transactionId.toUpperCase()}` : 'OnShift Financial Settlement',
      metadata: {
        // Remitter attribution lets the verification engine classify this as an
        // attributable platform settlement (required for FINANCIALLY_CORROBORATED).
        remitter: accountInfo.remitter || txn.description || 'Gig Platform Escrow Private Limited',
      },
      timestamp,
      capturedAt: new Date().toISOString(),
      previousHash,
      integrityHash,
    });

    createdEvidence.push(doc);
  }

  return res.status(200).json({
    message:
      reusedCount > 0
        ? 'Financial data fetched and normalized into evidence chain (existing evidence reused).'
        : 'Financial data fetched and normalized into evidence chain.',
    consentId,
    evidenceCount: createdEvidence.length,
    reusedCount,
    evidence: createdEvidence,
  });
};
