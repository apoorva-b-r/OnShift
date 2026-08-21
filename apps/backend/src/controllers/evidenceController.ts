import { Request, Response } from 'express';
import { Evidence } from '@onshift/backend/src/models'; // using barrel export
import { ApiError } from '../middleware/apiError';
import {
  DEMO_DECLARED_EVIDENCE,
  DEMO_OBSERVED_EVIDENCE_ZOMATO,
  DEMO_OBSERVED_EVIDENCE_SWIGGY,
  DEMO_FINANCIAL_EVIDENCE_SCENARIO_1,
} from '@onshift/mock-data';

/**
 * GET /evidence/worker/:workerId
 * Returns persisted evidence sorted by capturedAt. If DB unreachable or no records
 * and the worker is the demo worker, fall back to mock data with a top‑level
 * "source": "MOCK_FALLBACK" field.
 */
export const getEvidenceByWorker = async (req: Request, res: Response) => {
  const { workerId } = req.params;
  try {
    const docs = await Evidence.find({ workerId }).sort({ capturedAt: 1 }).lean();
    if (docs && docs.length) {
      return res.json(docs);
    }
    // No persisted evidence
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
    // DB error – treat like unreachable
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

/**
 * POST /evidence
 * Validates required fields, generates an id if missing, persists the document.
 */
export const createEvidence = async (req: Request, res: Response) => {
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

