import { Request, Response } from 'express';
import {
  DEMO_DECLARED_EVIDENCE,
  DEMO_OBSERVED_EVIDENCE_ZOMATO,
  DEMO_OBSERVED_EVIDENCE_SWIGGY,
  DEMO_FINANCIAL_EVIDENCE_SCENARIO_1,
} from '@onshift/mock-data';

export const getEvidenceByWorker = async (req: Request, res: Response) => {
  return res.json([
    DEMO_DECLARED_EVIDENCE,
    DEMO_OBSERVED_EVIDENCE_ZOMATO,
    DEMO_OBSERVED_EVIDENCE_SWIGGY,
    DEMO_FINANCIAL_EVIDENCE_SCENARIO_1,
  ]);
};

export const createEvidence = async (req: Request, res: Response) => {
  const evidence = req.body;
  const created = {
    ...evidence,
    id: evidence.id || `ev-${Date.now().toString(36)}`,
    capturedAt: new Date().toISOString(),
  };
  return res.status(201).json(created);
};
