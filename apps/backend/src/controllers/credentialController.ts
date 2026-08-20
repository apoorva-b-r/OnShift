import { Request, Response } from 'express';
import { issueCredential, verifyCredential } from '../services/credentialService';

export const handleIssueCredential = async (req: Request, res: Response) => {
  const { workerId, disclosedClaims } = req.body;

  const defaultClaims = {
    verifiedIncome: 30100,
    period: '01 Aug to 07 Aug 2026',
    verificationLevel: 'FINANCIALLY_CORROBORATED' as const,
  };

  const credential = issueCredential(workerId || 'OS-DEMO-001', disclosedClaims || defaultClaims);
  return res.status(201).json({ credential });
};

export const handleVerifyCredential = async (req: Request, res: Response) => {
  const credential = req.body;
  const result = verifyCredential(credential);
  return res.json(result);
};
