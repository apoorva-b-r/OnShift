import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ConsentRequest } from '../models/ConsentRequest';
import { getAAService } from '../services/aa';

export const renderConsentPage = async (req: Request, res: Response) => {
  const { consentId } = req.params;
  const step = req.query.step;

  let consent: any = null;
  if (mongoose.connection.readyState === 1) {
    consent = await ConsentRequest.findOne({ consentId }).lean();
  }

  const workerId = consent ? consent.workerId : 'OS-DEMO-WORKER';

  if (step === 'otp') {
    const fipId = (req.query.fipId as string) || 'onshift-mock-fip';
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Mock AA - OTP Verification</title></head>
        <body style="font-family: sans-serif; padding: 2rem; max-width: 500px; margin: 0 auto; border: 1px solid #ccc; margin-top: 2rem; border-radius: 8px;">
          <h2>Account Aggregator - Enter OTP</h2>
          <p>Worker ID: <strong>${workerId}</strong></p>
          <p>An OTP has been sent for bank verification. (Demo OTP: <strong>123456</strong>)</p>
          <form action="/api/v1/mock-aa/consent/${consentId}/approve" method="POST">
            <input type="hidden" name="fipId" value="${fipId}" />
            <input type="hidden" name="from" value="demo" />
            <div style="margin-bottom: 1rem;">
              <label for="otp">Enter OTP:</label><br/>
              <input type="text" id="otp" name="otp" value="123456" style="padding: 0.5rem; width: 100%; margin-top: 0.5rem; box-sizing: border-box;" required />
            </div>
            <button type="submit" style="padding: 0.5rem 1rem; background: #0066cc; color: white; border: none; border-radius: 4px; cursor: pointer;">Approve Consent</button>
          </form>
        </body>
      </html>
    `);
  }

  return res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>Mock AA - Consent Request</title></head>
      <body style="font-family: sans-serif; padding: 2rem; max-width: 500px; margin: 0 auto; border: 1px solid #ccc; margin-top: 2rem; border-radius: 8px;">
        <h2>OnShift Account Aggregator Authorization</h2>
        <p>Worker ID: <strong>${workerId}</strong></p>
        <p>Requested Info: <strong>Bank account transactions</strong></p>
        <form action="/api/v1/mock-aa/consent/${consentId}" method="GET">
          <input type="hidden" name="step" value="otp" />
          <div style="margin-bottom: 1rem;">
            <label for="fipId">Select Financial Information Provider (FIP):</label><br/>
            <select id="fipId" name="fipId" style="padding: 0.5rem; width: 100%; margin-top: 0.5rem; box-sizing: border-box;">
              <option value="onshift-mock-fip">OnShift Demo Bank</option>
            </select>
          </div>
          <button type="submit" style="padding: 0.5rem 1rem; background: #0066cc; color: white; border: none; border-radius: 4px; cursor: pointer;">Continue</button>
        </form>
      </body>
    </html>
  `);
};

export const approveConsent = async (req: Request, res: Response) => {
  const { consentId } = req.params;
  const fipId = req.body.fipId || 'onshift-mock-fip';
  const fromDemo = req.body.from === 'demo' || req.query.from === 'demo';

  // Update MongoDB if connected
  if (mongoose.connection.readyState === 1) {
    await ConsentRequest.findOneAndUpdate(
      { consentId },
      {
        status: 'ACTIVE',
        fipId,
        approvedAt: new Date(),
      }
    );
  }

  // Always update in-memory map via AAService so status check works
  // even when MongoDB is offline
  try {
    const aaService = getAAService() as any;
    if (aaService.consents && aaService.consents.has(consentId)) {
      const record = aaService.consents.get(consentId);
      aaService.consents.set(consentId, { ...record, status: 'ACTIVE', fipId });
    }
  } catch (_) {
    // ignore — best effort
  }

  // If called from standalone demo page, redirect back to it
  if (fromDemo) {
    const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
    return res.redirect(`${baseUrl}/api/v1/mock-aa/demo?approved=${consentId}`);
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return res.redirect(`${frontendUrl}/financial-verification?consentId=${consentId}&status=approved`);
};
