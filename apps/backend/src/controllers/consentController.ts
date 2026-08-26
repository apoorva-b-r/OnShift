import { Request, Response } from 'express';
import { ConsentRequest } from '../models';
import { ApiError } from '../middleware/apiError';

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
  const { aaProvider = 'Setu Mock AA', fiTypes = ['DEPOSIT'] } = req.body;
  const consentId = `AA-CONSENT-${Date.now().toString(36).toUpperCase()}`;
  const authorizationUrl = `https://aa-sandbox.onshift.org/auth/${consentId}`;
  const isMock = aaProvider.toLowerCase().includes('mock') || true;

  try {
    await ConsentRequest.create({
      consentId: consent.consentId,
      workerId,
      fiTypes,
      status: consent.status === 'REJECTED' ? 'EXPIRED' : consent.status,
      consentUrl: consent.redirectUrl,
      isMock: consent.isMock === true,
    });
  } catch (_error) {
    console.warn('Failed to persist consent request to MongoDB.');
  }

  return res.status(201).json(consent);
};

export const fetchFinancialData = async (req: Request, res: Response) => {
  const transactions = await getAccountAggregatorProvider().fetchFinancialData(req.params.consentId);
  return res.status(200).json(transactions);
};

export const getConsentStatus = async (req: Request, res: Response) => {
  const authWorkerId = req.user?.workerId;
  if (!authWorkerId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authenticated worker ID is required.');
  }

  const { consentId } = req.params;
  try {
    const consent = await ConsentRequest.findOne({ consentId, workerId: authWorkerId });
    if (!consent) {
      const otherWorkerConsent = await ConsentRequest.findOne({ consentId });
      if (otherWorkerConsent && otherWorkerConsent.workerId !== authWorkerId) {
        throw new ApiError(
          403,
          'FORBIDDEN_CONSENT_ACCESS',
          `Consent request ${consentId} belongs to another worker.`
        );
      }
      return res.status(404).json({ error: 'Consent request not found.' });
    }
    return res.status(200).json(consent);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    return res.status(500).json({ error: 'Failed to fetch consent status.' });
  }
};
