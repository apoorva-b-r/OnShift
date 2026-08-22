import { Router } from 'express';
import { getWorker, createWorker } from '../controllers/workerController';
import { getEvidenceByWorker, createEvidence } from '../controllers/evidenceController';
import { executeReconciliation } from '../controllers/reconciliationController';
import { getVerificationLevel, runVerification } from '../controllers/verificationController';
import { handleIssueCredential, handleVerifyCredential } from '../controllers/credentialController';
import { getSchemes, matchSchemes, recommendSchemes } from '../controllers/schemeController';
import { requestConsent, getConsentStatus, fetchFinancialData } from '../controllers/consentController';
import { asyncHandler } from '../middleware/apiError';
import { authenticateWorker } from '../middleware/authMiddleware';
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

// Health
router.get('/health', (_req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'OnShift Main Application API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Workers
router.get('/workers/:id', asyncHandler(getWorker));
router.post('/workers', validateRequest(validateWorker), asyncHandler(createWorker));

// Evidence
router.get('/evidence/worker/:workerId', asyncHandler(getEvidenceByWorker));
router.post('/evidence', authenticateWorker, validateRequest(validateEvidence), asyncHandler(createEvidence));

// Reconciliation & Verification
router.post('/reconciliation/run', authenticateWorker, validateRequest(validateReconciliation), asyncHandler(executeReconciliation));
router.post('/verification/level', validateRequest(validateVerification), asyncHandler(getVerificationLevel));
router.post('/verification/run', authenticateWorker, asyncHandler(runVerification));

// Credentials
router.post('/credentials/issue', authenticateWorker, validateRequest(validateCredentialIssue), asyncHandler(handleIssueCredential));
router.post('/credentials/verify', validateRequest(validateCredentialVerify), asyncHandler(handleVerifyCredential));

// Government Schemes
router.get('/schemes', asyncHandler(getSchemes));
router.post('/schemes/match', validateRequest(validateSchemeMatch), asyncHandler(matchSchemes));
router.post('/schemes/recommend', asyncHandler(recommendSchemes));

// Account Aggregator Consent
router.post('/consent/request', validateRequest(validateConsentRequest), asyncHandler(requestConsent));
router.get('/consent/status/:consentId', asyncHandler(getConsentStatus));
router.get('/consent/data/:consentId', asyncHandler(fetchFinancialData));

export default router;
