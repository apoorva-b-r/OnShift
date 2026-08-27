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
/**
 * GET /api/v1/identity/digilocker/mock-auth
 * Interactive mock DigiLocker authorization screen for local testing and physical devices.
 */
export const renderMockDigiLockerAuth = async (req: Request, res: Response) => {
  const { id: requestId } = req.query;
  const safeReqId = String(requestId || 'mock_req_12345');

  return res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>DigiLocker - Aadhaar Verification</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background: #0B1120;
          color: #F8FAFC;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 16px;
        }
        .container {
          background: #1E293B;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 20px;
          padding: 30px;
          max-width: 440px;
          width: 100%;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
        }
        .header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 22px;
          padding-bottom: 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .logo-badge {
          width: 42px;
          height: 42px;
          background: #0284C7;
          color: #FFFFFF;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 1.2rem;
        }
        .header-text h3 {
          font-size: 1.05rem;
          font-weight: 700;
          color: #F8FAFC;
        }
        .header-text p {
          font-size: 0.75rem;
          color: #94A3B8;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .step-progress {
          display: flex;
          justify-content: space-between;
          margin-bottom: 24px;
          position: relative;
        }
        .step-indicator {
          flex: 1;
          text-align: center;
          font-size: 0.72rem;
          font-weight: 700;
          color: #64748B;
          position: relative;
        }
        .step-indicator.active {
          color: #38BDF8;
        }
        .step-indicator.done {
          color: #10B981;
        }
        .step-bar {
          height: 4px;
          background: #334155;
          border-radius: 2px;
          margin-top: 6px;
          transition: background 0.3s;
        }
        .step-indicator.active .step-bar {
          background: #38BDF8;
        }
        .step-indicator.done .step-bar {
          background: #10B981;
        }
        .stage {
          display: none;
        }
        .stage.active {
          display: block;
          animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        h2 {
          font-size: 1.25rem;
          font-weight: 800;
          color: #F8FAFC;
          margin-bottom: 8px;
        }
        .subtitle {
          color: #94A3B8;
          font-size: 0.85rem;
          margin-bottom: 20px;
          line-height: 1.45;
        }
        .form-group {
          margin-bottom: 18px;
          text-align: left;
        }
        label {
          display: block;
          font-size: 0.8rem;
          font-weight: 600;
          color: #CBD5E1;
          margin-bottom: 6px;
        }
        .input-box {
          width: 100%;
          padding: 13px 14px;
          background: #0F172A;
          border: 1.5px solid #334155;
          border-radius: 10px;
          color: #F8FAFC;
          font-size: 1.1rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          outline: none;
          transition: border-color 0.2s;
        }
        .input-box:focus {
          border-color: #38BDF8;
        }
        .hint-pill {
          display: inline-block;
          background: rgba(56, 189, 248, 0.12);
          color: #38BDF8;
          border: 1px solid rgba(56, 189, 248, 0.25);
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 4px 8px;
          margin-top: 6px;
        }
        .consent-check {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 22px;
          font-size: 0.78rem;
          color: #94A3B8;
          line-height: 1.4;
          cursor: pointer;
        }
        .consent-check input {
          margin-top: 3px;
          accent-color: #0284C7;
        }
        .btn-primary {
          display: block;
          width: 100%;
          padding: 14px;
          background: #0284C7;
          color: #FFFFFF;
          border-radius: 10px;
          font-weight: 700;
          font-size: 0.95rem;
          border: none;
          cursor: pointer;
          transition: background 0.2s;
          box-shadow: 0 4px 14px rgba(2, 132, 199, 0.35);
        }
        .btn-primary:hover {
          background: #0369A1;
        }
        .details-grid {
          background: #0F172A;
          border: 1px solid #334155;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 22px;
          text-align: left;
        }
        .detail-item {
          display: flex;
          justify-content: space-between;
          padding: 7px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          font-size: 0.88rem;
        }
        .detail-item:last-child {
          border-bottom: none;
        }
        .detail-label {
          color: #94A3B8;
          font-weight: 500;
        }
        .detail-val {
          color: #F8FAFC;
          font-weight: 700;
        }
        .success-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(16, 185, 129, 0.15);
          color: #34D399;
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 20px;
          padding: 4px 12px;
          font-size: 0.78rem;
          font-weight: 700;
          margin-bottom: 16px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <div class="header">
          <div class="logo-badge">DL</div>
          <div class="header-text">
            <h3>DigiLocker e-KYC</h3>
            <p>National e-Governance Division</p>
          </div>
        </div>

        <!-- Progress Tracker -->
        <div class="step-progress">
          <div class="step-indicator active" id="ind-1">
            1. Aadhaar
            <div class="step-bar"></div>
          </div>
          <div class="step-indicator" id="ind-2">
            2. OTP Verify
            <div class="step-bar"></div>
          </div>
          <div class="step-indicator" id="ind-3">
            3. Grant Consent
            <div class="step-bar"></div>
          </div>
        </div>

        <!-- Stage 1: Aadhaar Input -->
        <div class="stage active" id="stage-1">
          <h2>Enter Aadhaar Number</h2>
          <p class="subtitle">Enter your 12-digit Aadhaar / Virtual ID to initiate instant e-KYC authentication.</p>
          
          <div class="form-group">
            <label>Aadhaar / VID Number</label>
            <input
              type="text"
              id="aadhaar-input"
              class="input-box"
              maxlength="14"
              value="5678 1234 4242"
              placeholder="XXXX XXXX XXXX"
            />
            <span class="hint-pill">Demo Aadhaar ID ready</span>
          </div>

          <label class="consent-check">
            <input type="checkbox" checked id="consent-box" />
            <span>I allow DigiLocker to fetch my Aadhaar identity details and share verified e-KYC with OnShift.</span>
          </label>

          <button type="button" class="btn-primary" onclick="goToStage2()">Get OTP</button>
        </div>

        <!-- Stage 2: OTP Verification -->
        <div class="stage" id="stage-2">
          <h2>Enter Aadhaar OTP</h2>
          <p class="subtitle">Enter the 6-digit one-time password sent to your Aadhaar-linked mobile ending in <strong>******4242</strong>.</p>
          
          <div class="form-group">
            <label>One Time Password (OTP)</label>
            <input
              type="text"
              id="otp-input"
              class="input-box"
              maxlength="6"
              value="123456"
              placeholder="123456"
              style="letter-spacing: 0.3em; text-align: center;"
            />
            <span class="hint-pill">Sandbox Demo OTP: 123456</span>
          </div>

          <button type="button" class="btn-primary" onclick="goToStage3()">Submit OTP & Verify</button>
        </div>

        <!-- Stage 3: Confirmation & Approval -->
        <div class="stage" id="stage-3">
          <div class="success-badge">
            ✓ Aadhaar e-KYC Verified
          </div>
          <h2>Confirm & Share KYC</h2>
          <p class="subtitle">UIDAI has verified your identity credentials. Review and complete registration for OnShift.</p>
          
          <div class="details-grid">
            <div class="detail-item">
              <span class="detail-label">Full Name</span>
              <span class="detail-val">Vikram Malhotra</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Masked Aadhaar</span>
              <span class="detail-val">XXXX-XXXX-4242</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">DOB</span>
              <span class="detail-val">14-05-1992</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Gender</span>
              <span class="detail-val">MALE</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">UIDAI Signature</span>
              <span class="detail-val" style="color: #34D399;">✓ Cryptographically Valid</span>
            </div>
          </div>

          <form method="GET" action="/api/v1/identity/digilocker/callback">
            <input type="hidden" name="success" value="True" />
            <input type="hidden" name="id" value="${safeReqId}" />
            <input type="hidden" name="scope" value="ADHAR" />
            <button type="submit" class="btn-primary" style="background: #10B981;">Allow & Return to OnShift</button>
          </form>
        </div>
      </div>

      <script>
        function goToStage2() {
          const aadharVal = document.getElementById('aadhaar-input').value.trim();
          if (aadharVal.length < 12) {
            alert('Please enter a valid 12-digit Aadhaar number.');
            return;
          }
          document.getElementById('stage-1').classList.remove('active');
          document.getElementById('stage-2').classList.add('active');
          document.getElementById('ind-1').classList.add('done');
          document.getElementById('ind-2').classList.add('active');
        }

        function goToStage3() {
          const otpVal = document.getElementById('otp-input').value.trim();
          if (otpVal.length < 6) {
            alert('Please enter the 6-digit OTP.');
            return;
          }
          document.getElementById('stage-2').classList.remove('active');
          document.getElementById('stage-3').classList.add('active');
          document.getElementById('ind-2').classList.add('done');
          document.getElementById('ind-3').classList.add('active');
        }

        // Format Aadhaar with spaces
        const aadhInput = document.getElementById('aadhaar-input');
        if (aadhInput) {
          aadhInput.addEventListener('input', function (e) {
            let val = e.target.value.replace(/\\D/g, '');
            if (val.length > 12) val = val.substring(0, 12);
            let formatted = '';
            for (let i = 0; i < val.length; i++) {
              if (i > 0 && i % 4 === 0) formatted += ' ';
              formatted += val[i];
            }
            e.target.value = formatted;
          });
        }
      </script>
    </body>
    </html>
  `);
};

/**
 * GET /api/v1/identity/digilocker/callback
 * Setu DigiLocker OAuth / eKYC redirect callback handler.
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
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>DigiLocker Authorization Successful</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; background: #0B0F19; color: #F9FAFB; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; text-align: center; padding: 20px; }
        .card { background: rgba(17, 24, 39, 0.9); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 16px; padding: 32px; max-width: 420px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
        h2 { color: #34D399; margin-bottom: 12px; font-size: 1.4rem; }
        p { color: #9CA3AF; font-size: 0.95rem; line-height: 1.5; margin-bottom: 20px; }
        .btn { display: inline-block; padding: 12px 24px; background: #10B981; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>✓ DigiLocker Authorization Received</h2>
        <p>Your DigiLocker eKYC authorization was received successfully. You can now close this tab and return to the OnShift app to tap "Complete & Verify Identity".</p>
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

