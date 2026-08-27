import { Router } from 'express';
import { getWorker, createWorker } from '../controllers/workerController';
import { login } from '../controllers/authController';
import { getEvidenceByWorker, createEvidence } from '../controllers/evidenceController';
import { executeReconciliation } from '../controllers/reconciliationController';
import { getVerificationLevel, runVerification } from '../controllers/verificationController';
import { handleIssueCredential, handleVerifyCredential, handleVerifyCredentialById, handleGetCredentialMessages } from '../controllers/credentialController';
import { getSchemes, matchSchemes, recommendSchemes } from '../controllers/schemeController';
import { requestConsent, getConsentStatus, fetchFinancialData } from '../controllers/consentController';
import {
  initiateDigiLocker,
  getDigiLockerStatus,
  verifyDigiLocker,
  handleDigiLockerCallback,
} from '../controllers/identityController';
import { sendOtpHandler, verifyOtpHandler } from '../controllers/otpController';
import { setIdentityVerified } from '../controllers/adminController';
import { asyncHandler } from '../middleware/apiError';
import { authenticateWorker, requireRole } from '../middleware/authMiddleware';
import mockAaRoutes from './mockAaRoutes';
import {
  validateConsentRequest,
  validateCredentialIssue,
  validateCredentialVerify,
  validateEvidence,
  validateReconciliation,
  validateRequest,
  validateSchemeMatch,
  validateVerification,
  validateWorker,
} from '../middleware/validateRequest';
import { ApiError } from '../middleware/apiError';

const router = Router();

const workerAuth = [authenticateWorker, requireRole('WORKER')];

// Development/demo token issuance only. Production must use a real identity
// provider and must not expose an endpoint that accepts a worker ID directly.
// Check at request time so tests and local development can enable the endpoint
// without changing the router module's initialisation order.
const requireDemoAuth: import('express').RequestHandler = (_req, _res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return next(new ApiError(404, 'NOT_FOUND', 'Route not found.'));
  }
  return next();
};

// Health (Public)
router.get('/health', (_req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'OnShift Main Application API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

router.post('/auth/login', requireDemoAuth, asyncHandler(login));

// Mock OTP Phone Verification (Protected)
router.post('/auth/otp/send', workerAuth, asyncHandler(sendOtpHandler));
router.post('/auth/otp/verify', workerAuth, asyncHandler(verifyOtpHandler));

// Workers (Protected)
router.get('/workers/:id', workerAuth, asyncHandler(getWorker));
router.post('/workers', workerAuth, validateRequest(validateWorker), asyncHandler(createWorker));

// Identity Verification (Setu DigiLocker)
router.get('/identity/digilocker/callback', asyncHandler(handleDigiLockerCallback));
router.post('/identity/digilocker/initiate', workerAuth, asyncHandler(initiateDigiLocker));
router.get('/identity/digilocker/status', workerAuth, asyncHandler(getDigiLockerStatus));
router.post('/identity/digilocker/verify', workerAuth, asyncHandler(verifyDigiLocker));

// Evidence (Protected)
router.get('/evidence/worker/:workerId', workerAuth, asyncHandler(getEvidenceByWorker));
router.post('/evidence', workerAuth, validateRequest(validateEvidence), asyncHandler(createEvidence));

// Reconciliation & Verification (Protected)
router.post('/reconciliation/run', workerAuth, validateRequest(validateReconciliation), asyncHandler(executeReconciliation));
router.post('/verification/level', workerAuth, validateRequest(validateVerification), asyncHandler(getVerificationLevel));
router.post('/verification/run', workerAuth, asyncHandler(runVerification));

// Credentials
router.post('/credentials/issue', workerAuth, validateRequest(validateCredentialIssue), asyncHandler(handleIssueCredential));
router.post('/credentials/verify', validateRequest(validateCredentialVerify), asyncHandler(handleVerifyCredential));
router.get('/credentials/verify/:credentialId', asyncHandler(handleVerifyCredentialById));
router.get('/credentials/messages/:workerId', workerAuth, asyncHandler(handleGetCredentialMessages));

// Government Schemes (Public)
router.get('/schemes', asyncHandler(getSchemes));
router.post('/schemes/match', validateRequest(validateSchemeMatch), asyncHandler(matchSchemes));
router.post('/schemes/recommend', asyncHandler(recommendSchemes));

// Account Aggregator Consent (Protected)
router.post('/consent/request', workerAuth, validateRequest(validateConsentRequest), asyncHandler(requestConsent));
router.get('/consent/status/:consentId', workerAuth, asyncHandler(getConsentStatus));
router.post('/consent/fetch-data', workerAuth, asyncHandler(fetchFinancialData));

// Mock Account Aggregator UI & Verification Routes
router.use('/mock-aa', mockAaRoutes);

// Admin Routes (Demo/Testing Only)
router.post('/admin/set-identity-verified', requireDemoAuth, asyncHandler(setIdentityVerified));

export default router;
