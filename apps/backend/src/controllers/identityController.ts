import { Request, Response } from 'express';
import { IdentityVerification, IdentityVerificationStatus } from '../models/IdentityVerification';
import { SetuDigiLockerService } from '../services/setuDigiLockerService';
import { ApiError } from '../middleware/apiError';

/**
 * POST /api/v1/identity/digilocker/initiate
 * Initiate a new Setu DigiLocker identity verification session.
 * Worker identity is strictly derived from req.user.workerId (JWT token).
 */
export const initiateDigiLocker = async (req: Request, res: Response) => {
  const workerId = req.user?.workerId;
  if (!workerId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authenticated worker identity required.');
  }

  // Create Setu DigiLocker request session
  const setuRes = await SetuDigiLockerService.createRequest();
  const validUptoDate = setuRes.validUpto ? new Date(setuRes.validUpto) : undefined;

  // Create or update the worker's IdentityVerification record in MongoDB
  let record = await IdentityVerification.findOne({ workerId });
  if (!record) {
    record = new IdentityVerification({
      workerId,
      provider: 'SETU_DIGILOCKER',
      requestId: setuRes.id,
      status: 'REQUEST_CREATED',
      validUpto: validUptoDate,
    });
  } else {
    record.provider = 'SETU_DIGILOCKER';
    record.requestId = setuRes.id;
    record.status = 'REQUEST_CREATED';
    record.validUpto = validUptoDate;
    record.verifiedAt = undefined;
  }
  await record.save();

  return res.status(200).json({
    requestId: setuRes.id,
    authorizationUrl: setuRes.url,
    status: 'REQUEST_CREATED',
    validUpto: setuRes.validUpto,
  });
};

/**
 * GET /api/v1/identity/digilocker/status
 * Check current Setu DigiLocker verification status for the authenticated worker.
 * Worker identity is strictly derived from req.user.workerId (JWT token).
 */
export const getDigiLockerStatus = async (req: Request, res: Response) => {
  const workerId = req.user?.workerId;
  if (!workerId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authenticated worker identity required.');
  }

  const record = await IdentityVerification.findOne({ workerId });

  if (!record || !record.requestId) {
    return res.status(200).json({
      status: 'NOT_STARTED',
      identityVerified: false,
      provider: 'SETU_DIGILOCKER',
    });
  }

  // Synchronize status with Setu if status is not already VERIFIED
  if (record.status !== 'VERIFIED') {
    try {
      const setuStatusRes = await SetuDigiLockerService.getStatus(record.requestId);
      const rawStatus = (setuStatusRes.status || '').toLowerCase();

      let newStatus: IdentityVerificationStatus = record.status;

      if (rawStatus === 'unauthenticated') {
        newStatus = 'REQUEST_CREATED';
      } else if (rawStatus === 'authenticated') {
        newStatus = 'AUTHENTICATED';
      } else if (rawStatus === 'failed') {
        newStatus = 'FAILED';
      } else if (rawStatus === 'expired') {
        newStatus = 'EXPIRED';
      } else if (rawStatus === 'revoked') {
        newStatus = 'REVOKED';
      }

      if (newStatus !== record.status) {
        record.status = newStatus;
        await record.save();
      }
    } catch (err) {
      if (err instanceof ApiError && err.statusCode >= 500) {
        // Upstream error; return current MongoDB record status
      } else {
        throw err;
      }
    }
  }

  return res.status(200).json({
    status: record.status,
    identityVerified: record.status === 'VERIFIED',
    provider: record.provider || 'SETU_DIGILOCKER',
    verifiedAt: record.verifiedAt ? record.verifiedAt.toISOString() : undefined,
  });
};

/**
 * POST /api/v1/identity/digilocker/verify
 * Complete Aadhaar payload verification for an authenticated Setu DigiLocker session.
 * Worker identity is strictly derived from req.user.workerId (JWT token).
 */
export const verifyDigiLocker = async (req: Request, res: Response) => {
  const workerId = req.user?.workerId;
  if (!workerId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authenticated worker identity required.');
  }

  const record = await IdentityVerification.findOne({ workerId });

  if (!record || !record.requestId) {
    throw new ApiError(400, 'NO_PENDING_REQUEST', 'No pending DigiLocker verification request found.');
  }

  // Fetch status from Setu first
  const setuStatusRes = await SetuDigiLockerService.getStatus(record.requestId);
  const rawStatus = (setuStatusRes.status || '').toLowerCase();

  // Must be authenticated before verify can be called
  if (rawStatus !== 'authenticated' && rawStatus !== 'complete' && record.status !== 'AUTHENTICATED' && record.status !== 'VERIFIED') {
    throw new ApiError(400, 'IDENTITY_NOT_AUTHENTICATED', 'DigiLocker session has not been authenticated by worker.');
  }

  try {
    // Fetch Aadhaar payload from Setu
    const aadhaarRes = await SetuDigiLockerService.getAadhaar(record.requestId);
    const aadhaar = aadhaarRes.aadhaar;

    // Validate payload (must contain signed payload or valid user data)
    const isValid =
      aadhaar &&
      (aadhaar.verified?.signature === true || !!aadhaar.maskedNumber || !!aadhaar.name);

    if (!isValid) {
      record.status = 'FAILED';
      await record.save();
      throw new ApiError(400, 'IDENTITY_VERIFICATION_FAILED', 'Aadhaar identity payload validation failed.');
    }

    // Success! Update MongoDB status to VERIFIED
    // PRIVACY INVARIANT: We do NOT store raw Aadhaar number or raw XML.
    const now = new Date();
    record.status = 'VERIFIED';
    record.verifiedAt = now;
    await record.save();

    return res.status(200).json({
      status: 'VERIFIED',
      identityVerified: true,
      provider: 'SETU_DIGILOCKER',
      verifiedAt: now.toISOString(),
    });
  } catch (err) {
    if (err instanceof ApiError && err.code === 'IDENTITY_VERIFICATION_FAILED') {
      throw err;
    }
    record.status = 'FAILED';
    await record.save();
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(400, 'IDENTITY_VERIFICATION_FAILED', 'Failed to verify Aadhaar identity payload.');
  }
};

/**
 * GET /api/v1/identity/digilocker/callback
 * Setu DigiLocker OAuth / eKYC redirect callback handler.
 * Setu redirects the browser tab here after user completes DigiLocker login:
 * /api/v1/identity/digilocker/callback?success=True&id=<requestId>&scope=ADHAR
 */
export const handleDigiLockerCallback = async (req: Request, res: Response) => {
  const { id: requestId, success } = req.query;

  if (requestId && typeof requestId === 'string') {
    try {
      const record = await IdentityVerification.findOne({ requestId });
      if (record && record.status !== 'VERIFIED') {
        const isSuccess = String(success).toLowerCase() === 'true';
        if (isSuccess) {
          record.status = 'AUTHENTICATED';
          await record.save();
        }
      }
    } catch (_) {}
  }

  const safeReqId = String(requestId || '');

  return res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>DigiLocker Authorization Successful</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; background: #0B0F19; color: #F9FAFB; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
        .card { background: rgba(17, 24, 39, 0.9); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 16px; padding: 32px; max-width: 420px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
        h2 { color: #34D399; margin-bottom: 12px; font-size: 1.4rem; }
        p { color: #9CA3AF; font-size: 0.95rem; line-height: 1.5; margin-bottom: 20px; }
        .btn { display: inline-block; padding: 12px 24px; background: #10B981; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>✓ DigiLocker Authorization Received</h2>
        <p>Your DigiLocker eKYC authorization was received successfully. You can now close this tab and return to the OnShift app to complete registration.</p>
        <button class="btn" onclick="window.close()">Close Tab & Return to OnShift</button>
      </div>
      <script>
        if (window.opener) {
          try {
            window.opener.postMessage({ type: 'DIGILOCKER_AUTH_COMPLETE', requestId: '${safeReqId}' }, '*');
          } catch (_) {}
          setTimeout(() => { window.close(); }, 2500);
        }
      </script>
    </body>
    </html>
  `);
};

