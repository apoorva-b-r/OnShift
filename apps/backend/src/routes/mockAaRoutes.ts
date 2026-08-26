import { Router } from 'express';
import express from 'express';
import path from 'path';
import { renderConsentPage, approveConsent } from '../controllers/mockAaController';

const router = Router();

router.use(express.urlencoded({ extended: true }));

router.get('/demo', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../public/consent-demo.html'));
});

router.get('/consent/:consentId', renderConsentPage);
router.post('/consent/:consentId/approve', approveConsent);

export default router;
