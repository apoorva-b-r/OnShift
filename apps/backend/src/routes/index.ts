import { Router } from 'express';
import { getWorker, createWorker } from '../controllers/workerController';
import { getEvidenceByWorker, createEvidence } from '../controllers/evidenceController';
import { executeReconciliation } from '../controllers/reconciliationController';
import { getVerificationLevel, runVerification } from '../controllers/verificationController';
import { handleIssueCredential, handleVerifyCredential } from '../controllers/credentialController';
import { getSchemes, matchSchemes, recommendSchemes } from '../controllers/schemeController';
import { requestConsent, getConsentStatus } from '../controllers/consentController';
import { login } from '../controllers/authController';
import { asyncHandler } from '../middleware/apiError';
import { authenticate, enforceWorkerOwnership, requireRole, authenticateWorker } from '../middleware/authMiddleware';
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

// ---------------------------------------------------------------------------
// Public routes — no auth required
// ---------------------------------------------------------------------------

// Health check
router.get('/health', (_req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'OnShift Main Application API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Credential verification is intentionally public — any verifier (employer,
// lender, scheme officer) must be able to verify a credential without a worker
// session. The credential itself carries the public key for signature checking.
router.post(
  '/credentials/verify',
  validateRequest(validateCredentialVerify),
  asyncHandler(handleVerifyCredential)
);

// Government scheme listing is public information
router.get('/schemes', asyncHandler(getSchemes));
router.post('/schemes/match', validateRequest(validateSchemeMatch), asyncHandler(matchSchemes));
router.post('/schemes/recommend', asyncHandler(recommendSchemes));

// Auth — login (dev/demo only)
router.post('/auth/login', asyncHandler(login));

// ---------------------------------------------------------------------------
// Protected routes — require valid JWT
// ---------------------------------------------------------------------------

// Workers
router.get('/workers/:id', authenticate, asyncHandler(getWorker));
router.post('/workers', authenticate, validateRequest(validateWorker), asyncHandler(createWorker));

// Evidence
router.get(
  '/evidence/worker/:workerId',
  authenticate,
  requireRole('WORKER', 'VERIFIER', 'ADMIN'),
  enforceWorkerOwnership,
  asyncHandler(getEvidenceByWorker)
);
router.post(
  '/evidence',
  authenticate,
  requireRole('WORKER'),
  enforceWorkerOwnership,
  validateRequest(validateEvidence),
  asyncHandler(createEvidence)
);

// Reconciliation & Verification
router.post(
  '/reconciliation/run',
  authenticate,
  requireRole('WORKER', 'VERIFIER', 'ADMIN'),
  enforceWorkerOwnership,
  validateRequest(validateReconciliation),
  asyncHandler(executeReconciliation)
);
router.post(
  '/verification/level',
  authenticate,
  requireRole('WORKER', 'VERIFIER', 'ADMIN'),
  enforceWorkerOwnership,
  validateRequest(validateVerification),
  asyncHandler(getVerificationLevel)
);
router.post(
  '/verification/run',
  authenticate,
  requireRole('WORKER', 'VERIFIER', 'ADMIN'),
  enforceWorkerOwnership,
  asyncHandler(runVerification)
);

// Credentials — issuance is worker-scoped
router.post(
  '/credentials/issue',
  authenticate,
  requireRole('WORKER'),
  enforceWorkerOwnership,
  validateRequest(validateCredentialIssue),
  asyncHandler(handleIssueCredential)
);

// Account Aggregator Consent — worker-scoped
router.post(
  '/consent/request',
  authenticate,
  requireRole('WORKER'),
  enforceWorkerOwnership,
  validateRequest(validateConsentRequest),
  asyncHandler(requestConsent)
);
// Consent status
router.get('/consent/status/:consentId', authenticate, asyncHandler(getConsentStatus));

export default router;
