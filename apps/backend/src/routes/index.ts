import { Router } from 'express';
import { getWorker, createWorker } from '../controllers/workerController';
import { getEvidenceByWorker, createEvidence } from '../controllers/evidenceController';
import { executeReconciliation } from '../controllers/reconciliationController';
import { getVerificationLevel, runVerification } from '../controllers/verificationController';
import { handleIssueCredential, handleVerifyCredential } from '../controllers/credentialController';
import { getSchemes, matchSchemes, recommendSchemes } from '../controllers/schemeController';
import { requestConsent, getConsentStatus } from '../controllers/consentController';
import {
  initiateDigiLocker,
  getDigiLockerStatus,
  verifyDigiLocker,
  handleDigiLockerCallback,
} from '../controllers/identityController';
import { asyncHandler } from '../middleware/apiError';
import { authenticateWorker, requireRole } from '../middleware/authMiddleware';
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

const router = Router();

const workerAuth = [authenticateWorker, requireRole('WORKER')];

// Health (Public)
router.get('/health', (_req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'OnShift Main Application API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

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

// Government Schemes (Public)
router.get('/schemes', asyncHandler(getSchemes));
router.post('/schemes/match', validateRequest(validateSchemeMatch), asyncHandler(matchSchemes));
router.post('/schemes/recommend', asyncHandler(recommendSchemes));

// Account Aggregator Consent (Protected)
router.post('/consent/request', workerAuth, validateRequest(validateConsentRequest), asyncHandler(requestConsent));
router.get('/consent/status/:consentId', workerAuth, asyncHandler(getConsentStatus));

export default router;
