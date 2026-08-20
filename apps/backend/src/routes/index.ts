import { Router } from 'express';
import { getWorker, createWorker } from '../controllers/workerController';
import { getEvidenceByWorker, createEvidence } from '../controllers/evidenceController';
import { executeReconciliation } from '../controllers/reconciliationController';
import { getVerificationLevel } from '../controllers/verificationController';
import { handleIssueCredential, handleVerifyCredential } from '../controllers/credentialController';
import { getSchemes, matchSchemes } from '../controllers/schemeController';
import { requestConsent, getConsentStatus } from '../controllers/consentController';

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
router.get('/workers/:id', getWorker);
router.post('/workers', createWorker);

// Evidence
router.get('/evidence/worker/:workerId', getEvidenceByWorker);
router.post('/evidence', createEvidence);

// Reconciliation & Verification
router.post('/reconciliation/run', executeReconciliation);
router.post('/verification/level', getVerificationLevel);

// Credentials
router.post('/credentials/issue', handleIssueCredential);
router.post('/credentials/verify', handleVerifyCredential);

// Government Schemes
router.get('/schemes', getSchemes);
router.post('/schemes/match', matchSchemes);

// Account Aggregator Consent
router.post('/consent/request', requestConsent);
router.get('/consent/status/:consentId', getConsentStatus);

export default router;
