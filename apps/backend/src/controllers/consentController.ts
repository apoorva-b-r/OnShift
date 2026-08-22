import { Request, Response } from 'express';
import { ConsentRequest } from '../models';
import { getEffectiveWorkerId } from '../middleware/authMiddleware';

export const requestConsent = async (req: Request, res: Response) => {
  const workerId = getEffectiveWorkerId(req);

  const { aaProvider = 'Setu Mock AA', fiTypes = ['DEPOSIT'] } = req.body;
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
  try {
    const consent = await ConsentRequest.findOne({ consentId });
    if (!consent) {
      return res.status(404).json({ error: 'Consent request not found.' });
    }
    return res.status(200).json(consent);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch consent status.' });
  }
};
