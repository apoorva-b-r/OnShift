import { Request, Response } from 'express';
import { Evidence } from '../models';
import { ApiError } from '../middleware/apiError';
import { getEffectiveWorkerId } from '../middleware/authMiddleware';
import {
  DEMO_DECLARED_EVIDENCE,
  DEMO_OBSERVED_EVIDENCE_ZOMATO,
  DEMO_OBSERVED_EVIDENCE_SWIGGY,
  DEMO_FINANCIAL_EVIDENCE_SCENARIO_1,
} from '@onshift/mock-data';

export const getEvidenceByWorker = async (req: Request, res: Response) => {
  const { workerId } = req.params;
  try {
    const docs = await Evidence.find({ workerId }).sort({ capturedAt: 1 }).lean();
    if (docs && docs.length) {
      return res.json(docs);
    }
    if (workerId === 'OS-DEMO-001') {
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
    if (workerId === 'OS-DEMO-001') {
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

export const createEvidence = async (req: Request, res: Response) => {
  const workerId = getEffectiveWorkerId(req);

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

  const evidenceDoc = {
    ...rest,
    workerId,
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
    id: req.body.id || `ev-${Date.now().toString(36)}`,
  };

  try {
    const saved = await Evidence.create(evidenceDoc);
    return res.status(201).json(saved);
  } catch (err) {
    console.warn('Failed to persist Evidence document.');
    throw new ApiError(500, 'DATABASE_ERROR', 'Failed to save evidence.');
  }
};
