import { Request, Response } from 'express';
import { ConsentRequest } from '../models';
import { getAccountAggregatorProvider } from '../services/aa/getAccountAggregatorProvider';

export const requestConsent = async (req: Request, res: Response) => {
  const { workerId = 'OS-DEMO-001', fiTypes = ['DEPOSIT'] } = req.body;
  const consent = await getAccountAggregatorProvider().requestConsent({
    customerId: workerId,
    purpose: 'OnShift income verification',
    fiTypes,
    dataRange: req.body.dataRange ?? {
      from: new Date(0).toISOString(),
      to: new Date().toISOString(),
    },
  });

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
