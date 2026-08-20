import { Request, Response } from 'express';

export const requestConsent = async (req: Request, res: Response) => {
  const { workerId, aaProvider = 'Setu Mock AA' } = req.body;
  const consentId = `AA-CONSENT-${Date.now().toString(36).toUpperCase()}`;

  return res.status(201).json({
    consentId,
    workerId: workerId || 'OS-DEMO-001',
    aaProvider,
    status: 'PENDING',
    authorizationUrl: `https://aa-sandbox.onshift.org/auth/${consentId}`,
    createdAt: new Date().toISOString(),
  });
};

export const getConsentStatus = async (req: Request, res: Response) => {
  const { consentId } = req.params;
  return res.json({
    consentId,
    status: 'APPROVED',
    workerId: 'OS-DEMO-001',
    linkedAccounts: [
      {
        bankName: 'HDFC Bank',
        accountMask: 'XX4821',
        accountType: 'SAVINGS',
      },
    ],
    updatedAt: new Date().toISOString(),
  });
};
