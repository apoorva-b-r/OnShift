import { Request, Response } from 'express';
import { createHash } from 'crypto';
import { Evidence } from '../models';
import { ApiError } from '../middleware/apiError';
import {
  DEMO_DECLARED_EVIDENCE,
  DEMO_OBSERVED_EVIDENCE_ZOMATO,
  DEMO_OBSERVED_EVIDENCE_SWIGGY,
  DEMO_FINANCIAL_EVIDENCE_SCENARIO_1,
} from '@onshift/mock-data';

const GENESIS_HASH = 'GENESIS_0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Recomputes the SHA-256 integrity hash over the canonical pipe-delimited fields.
 * Must match the Android HashChain.calculateRecordHash logic exactly.
 */
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

/**
 * GET /evidence/worker/:workerId
 * Returns persisted evidence sorted by capturedAt for the authenticated worker.
 */
export const getEvidenceByWorker = async (req: Request, res: Response) => {
  const authWorkerId = req.user?.workerId;
  if (!authWorkerId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authenticated worker identity required.');
  }

  const { workerId } = req.params;
  if (workerId !== authWorkerId) {
    throw new ApiError(
      403,
      'FORBIDDEN',
      `Authenticated identity (${authWorkerId}) cannot access evidence for worker (${workerId}).`
    );
  }

  try {
    const docs = await Evidence.find({ workerId: authWorkerId }).sort({ capturedAt: 1 }).lean();
    if (docs && docs.length) {
      return res.json(docs);
    }
    // No persisted evidence fallback for demo worker
    if (authWorkerId === 'OS-DEMO-001') {
      return res.json({
        source: 'MOCK_FALLBACK',
        evidence: [
          DEMO_DECLARED_EVIDENCE,
          DEMO_OBSERVED_EVIDENCE_ZOMATO,
          DEMO_OBSERVED_EVIDENCE_SWIGGY,
          DEMO_FINANCIAL_EVIDENCE_SCENARIO_1,
        ],
      });
    }
    return res.json([]);
  } catch (err) {
    if (authWorkerId === 'OS-DEMO-001') {
      return res.json({
        source: 'MOCK_FALLBACK',
        evidence: [
          DEMO_DECLARED_EVIDENCE,
          DEMO_OBSERVED_EVIDENCE_ZOMATO,
          DEMO_OBSERVED_EVIDENCE_SWIGGY,
          DEMO_FINANCIAL_EVIDENCE_SCENARIO_1,
        ],
      });
    }
    console.warn('Failed to query Evidence collection.');
    return res.status(500).json({ error: 'Database query failed.' });
  }
};

/**
 * POST /evidence
 * Validates required fields, generates an id if missing, persists evidence strictly owned by req.user.workerId.
 */
export const createEvidence = async (req: Request, res: Response) => {
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

  const {
    source,
    type,
    platform,
    timestamp,
    amount,
    currency,
    reference,
    capturedAt,
    previousHash,
    integrityHash,
    ...rest
  } = req.body;

  const evidenceId = req.body.id || `ev-${Date.now().toString(36)}`;

  // ──────────────────────────────────────────────────────────────────────────
  // SERVER-SIDE HASH CHAIN VALIDATION
  // Verify that the incoming record extends the existing chain for this worker.
  // ──────────────────────────────────────────────────────────────────────────
  try {
    const lastRecord = await Evidence.findOne({ workerId: authWorkerId })
      .sort({ capturedAt: -1 })
      .lean();

    const expectedPreviousHash = lastRecord
      ? (lastRecord.integrityHash as string)
      : GENESIS_HASH;

    if (!previousHash) {
      throw new ApiError(
        422,
        'HASH_CHAIN_VIOLATION',
        'Missing previousHash. Evidence must include the hash of the preceding record.'
      );
    }

    if (previousHash !== expectedPreviousHash) {
      throw new ApiError(
        422,
        'HASH_CHAIN_VIOLATION',
        `previousHash mismatch. Expected "${expectedPreviousHash}" but received "${previousHash}".`
      );
    }

    if (integrityHash) {
      const recomputedHash = computeIntegrityHash(
        evidenceId,
        authWorkerId,
        source,
        platform,
        amount,
        timestamp,
        previousHash
      );
      if (integrityHash !== recomputedHash) {
        throw new ApiError(
          422,
          'HASH_CHAIN_VIOLATION',
          `integrityHash mismatch. The supplied hash does not match the server-computed SHA-256 for this record.`
        );
      }
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.warn('Hash chain validation skipped due to DB query error:', err);
  }

  const evidenceDoc = {
    ...rest,
    workerId: authWorkerId,
    source,
    type,
    platform,
    timestamp,
    amount,
    currency,
    reference,
    capturedAt,
    previousHash,
    integrityHash,
    id: evidenceId,
  };

  try {
    const saved = await Evidence.create(evidenceDoc);
    return res.status(201).json(saved);
  } catch (err) {
    console.warn('Failed to persist Evidence document.');
    throw new ApiError(500, 'DATABASE_ERROR', 'Failed to save evidence.');
  }
};
