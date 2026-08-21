import { Request, Response } from 'express';
import { ConsentRequest } from '../models';

export const requestConsent = async (req: Request, res: Response) => {
  const { workerId = 'OS-DEMO-001', aaProvider = 'Setu Mock AA', fiTypes = ['DEPOSIT'] } = req.body;
  const consentId = `AA-CONSENT-${Date.now().toString(36).toUpperCase()}`;
  const authorizationUrl = `https://aa-sandbox.onshift.org/auth/${consentId}`;
  const isMock = aaProvider.toLowerCase().includes('mock') || true;

  try {
    await ConsentRequest.create({
      consentId,
      workerId,
      fiTypes,
      status: 'PENDING',
      consentUrl: authorizationUrl,
      isMock,
    });
  } catch (err) {
    console.warn('Failed to persist consent request to MongoDB, returning mock response.');
  }

  return res.status(201).json({
    consentId,
    workerId,
    aaProvider,
    status: 'PENDING',
    authorizationUrl,
    isMock,
    createdAt: new Date().toISOString(),
  });
};

export const getConsentStatus = async (req: Request, res: Response) => {
  const { consentId } = req.params;

  let existing = null;
  try {
    existing = await ConsentRequest.findOne({ consentId });
  } catch (err) {
    console.warn('MongoDB query failed for consent status, using fallback.');
  }

  const status = existing ? existing.status : 'ACTIVE';
  const isMock = existing ? existing.isMock : true;

  return res.json({
    consentId,
    status: status === 'PENDING' ? 'APPROVED' : status, // auto-approval for sandbox demo flow
    workerId: existing ? existing.workerId : 'OS-DEMO-001',
    isMock,
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
