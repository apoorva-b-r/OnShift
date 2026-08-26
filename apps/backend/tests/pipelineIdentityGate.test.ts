import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/index';
import { IdentityVerification, IDENTITY_VERIFICATION_STATUSES, VerificationRecord, Credential, Evidence } from '../src/models';
import { generateWorkerToken } from '../src/middleware/authMiddleware';
import { config } from '../src/config';

describe('Phase 4: Server-Side Identity Gate & Pipeline Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  const workerAToken = generateWorkerToken('OS-WORKER-GATE-A');
  const workerBToken = generateWorkerToken('OS-WORKER-GATE-B');

  jest.setTimeout(30000);

  beforeAll(async () => {
    (config as any).demoMode = true;
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    if (mongoose.connection.db) {
      await mongoose.connection.db.dropDatabase();
    }
  });

  // =========================================================================
  // G.1 to G.6: Non-VERIFIED Status Rejections
  // =========================================================================
  describe('1. Non-VERIFIED Identity Status Rejections at Credential Gate', () => {
    it('1. Worker without IdentityVerification record is rejected with 403 IDENTITY_VERIFICATION_REQUIRED', async () => {
      const vr = await VerificationRecord.create({
        id: 'vr-test-gate-001',
        workerId: 'OS-WORKER-GATE-A',
        payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
        level: 'FINANCIALLY_CORROBORATED',
        confidence: 0.95,
        reason: 'Matched',
        supportingEvidence: [],
        limitations: 'None',
        evidenceIds: [],
        verificationSource: 'AUTHORITATIVE_ENGINE',
        computedAt: new Date().toISOString(),
      });

      const res = await request(app)
        .post('/api/v1/credentials/issue')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ verificationId: vr.id });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('IDENTITY_VERIFICATION_REQUIRED');
      expect(res.body.message).toContain('DigiLocker identity verification is required');
    });

    const unverifiedStatuses = ['NOT_STARTED', 'REQUEST_CREATED', 'AUTHENTICATED', 'FAILED', 'EXPIRED', 'REVOKED'];

    unverifiedStatuses.forEach((status, index) => {
      it(`${index + 2}. Worker with identity status ${status} is rejected with 403 IDENTITY_VERIFICATION_REQUIRED`, async () => {
        const workerId = `OS-WORKER-GATE-${status}`;
        const token = generateWorkerToken(workerId);

        await IdentityVerification.create({
          workerId,
          provider: 'SETU_DIGILOCKER',
          requestId: `req-setu-${status}`,
          status,
        });

        const vr = await VerificationRecord.create({
          id: `vr-test-gate-${status}`,
          workerId,
          payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
          level: 'FINANCIALLY_CORROBORATED',
          confidence: 0.95,
          reason: 'Matched',
          supportingEvidence: [],
          limitations: 'None',
          evidenceIds: [],
          verificationSource: 'AUTHORITATIVE_ENGINE',
        computedAt: new Date().toISOString(),
        });

        const res = await request(app)
          .post('/api/v1/credentials/issue')
          .set('Authorization', `Bearer ${token}`)
          .send({ verificationId: vr.id });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('IDENTITY_VERIFICATION_REQUIRED');
      });
    });
  });

  // =========================================================================
  // G.7 to G.8: VERIFIED Status Access & Client Injection Guard
  // =========================================================================
  describe('2. VERIFIED Identity Gate Access & Client Injection Protection', () => {
    it('7. Worker with VERIFIED identity status can successfully issue a credential', async () => {
      await IdentityVerification.create({
        workerId: 'OS-WORKER-GATE-A',
        provider: 'SETU_DIGILOCKER',
        requestId: 'req-setu-verified-001',
        status: 'VERIFIED',
        verifiedAt: new Date(),
      });

      const vr = await VerificationRecord.create({
        id: 'vr-test-gate-verified',
        workerId: 'OS-WORKER-GATE-A',
        payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
        level: 'FINANCIALLY_CORROBORATED',
        confidence: 0.95,
        reason: 'Matched',
        supportingEvidence: [],
        limitations: 'None',
        evidenceIds: [],
        verificationSource: 'AUTHORITATIVE_ENGINE',
        computedAt: new Date().toISOString(),
      });

      const res = await request(app)
        .post('/api/v1/credentials/issue')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ verificationId: vr.id });

      expect(res.status).toBe(201);
      expect(res.body.credential).toBeDefined();
      expect(res.body.credential.workerId).toBe('OS-WORKER-GATE-A');
      expect(res.body.credential.claims.identityVerified).toBe(true);
    });

    it('8. Client sending identityVerified=true in body while DB is false is REJECTED', async () => {
      await IdentityVerification.create({
        workerId: 'OS-WORKER-GATE-A',
        provider: 'SETU_DIGILOCKER',
        requestId: 'req-setu-fake',
        status: 'AUTHENTICATED', // DB status is AUTHENTICATED, NOT VERIFIED
      });

      const vr = await VerificationRecord.create({
        id: 'vr-test-gate-fake-body',
        workerId: 'OS-WORKER-GATE-A',
        payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
        level: 'FINANCIALLY_CORROBORATED',
        confidence: 0.95,
        reason: 'Matched',
        supportingEvidence: [],
        limitations: 'None',
        evidenceIds: [],
        verificationSource: 'AUTHORITATIVE_ENGINE',
        computedAt: new Date().toISOString(),
      });

      // Malicious client injects identityVerified: true in request body
      const res = await request(app)
        .post('/api/v1/credentials/issue')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({
          verificationId: vr.id,
          identityVerified: true,
          disclosedClaims: { identityVerified: true },
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('IDENTITY_VERIFICATION_REQUIRED');
    });
  });

  // =========================================================================
  // G.9 to G.11: Cross-Worker Isolation & IDOR Attacks
  // =========================================================================
  describe('3. Cross-Worker Identity & Credential Isolation', () => {
    it('9 & 11. Worker A cannot issue credential using Worker B verificationRecord or workerId', async () => {
      // Worker B is VERIFIED
      await IdentityVerification.create({
        workerId: 'OS-WORKER-GATE-B',
        provider: 'SETU_DIGILOCKER',
        requestId: 'req-setu-b',
        status: 'VERIFIED',
        verifiedAt: new Date(),
      });

      const vrB = await VerificationRecord.create({
        id: 'vr-belonging-to-b',
        workerId: 'OS-WORKER-GATE-B',
        payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
        level: 'FINANCIALLY_CORROBORATED',
        confidence: 0.95,
        reason: 'Matched',
        supportingEvidence: [],
        limitations: 'None',
        evidenceIds: [],
        verificationSource: 'AUTHORITATIVE_ENGINE',
        computedAt: new Date().toISOString(),
      });

      // Worker A attempts to issue credential for vrB
      const res1 = await request(app)
        .post('/api/v1/credentials/issue')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ verificationId: vrB.id });

      // Worker A identity gate fails or mismatch fails
      expect([403]).toContain(res1.status);

      // Worker A attempts to pass workerId: OS-WORKER-GATE-B in body
      const res2 = await request(app)
        .post('/api/v1/credentials/issue')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ workerId: 'OS-WORKER-GATE-B', verificationId: vrB.id });

      expect(res2.status).toBe(403);
      expect(['WORKER_ID_MISMATCH', 'FORBIDDEN_WORKER_MISMATCH']).toContain(res2.body.error);
    });

    it('10. Worker A cannot bypass gate because Worker B is VERIFIED', async () => {
      // Worker B is VERIFIED, but Worker A is NOT_STARTED
      await IdentityVerification.create({
        workerId: 'OS-WORKER-GATE-B',
        provider: 'SETU_DIGILOCKER',
        requestId: 'req-setu-b-only',
        status: 'VERIFIED',
        verifiedAt: new Date(),
      });

      const vrA = await VerificationRecord.create({
        id: 'vr-belonging-to-a',
        workerId: 'OS-WORKER-GATE-A',
        payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
        level: 'FINANCIALLY_CORROBORATED',
        confidence: 0.95,
        reason: 'Matched',
        supportingEvidence: [],
        limitations: 'None',
        evidenceIds: [],
        verificationSource: 'AUTHORITATIVE_ENGINE',
        computedAt: new Date().toISOString(),
      });

      const res = await request(app)
        .post('/api/v1/credentials/issue')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ verificationId: vrA.id });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('IDENTITY_VERIFICATION_REQUIRED');
    });
  });

  // =========================================================================
  // G.12 to G.15: Idempotency & VerificationRecord Integration
  // =========================================================================
  describe('4. Idempotency & VerificationRecord Identity Attestation', () => {
    it('12. Credential idempotency behavior works cleanly for VERIFIED worker', async () => {
      await IdentityVerification.create({
        workerId: 'OS-WORKER-GATE-A',
        provider: 'SETU_DIGILOCKER',
        requestId: 'req-setu-idemp',
        status: 'VERIFIED',
        verifiedAt: new Date(),
      });

      const vr = await VerificationRecord.create({
        id: 'vr-idempotency-test',
        workerId: 'OS-WORKER-GATE-A',
        payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
        level: 'FINANCIALLY_CORROBORATED',
        confidence: 0.95,
        reason: 'Matched',
        supportingEvidence: [],
        limitations: 'None',
        evidenceIds: [],
        verificationSource: 'AUTHORITATIVE_ENGINE',
        computedAt: new Date().toISOString(),
      });

      // Issue 1
      const res1 = await request(app)
        .post('/api/v1/credentials/issue')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ verificationId: vr.id });

      expect(res1.status).toBe(201);
      const signature1 = res1.body.credential.signature;

      // Issue 2 (Idempotent return)
      const res2 = await request(app)
        .post('/api/v1/credentials/issue')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ verificationId: vr.id });

      expect(res2.status).toBe(200);
      expect(res2.body.credential.signature).toBe(signature1);
    });

    it('14 & 15. Authoritative verification pipeline sets identityVerified on VerificationRecord', async () => {
      await Evidence.create({
        id: 'ev-gate-a-1',
        workerId: 'OS-WORKER-GATE-A',
        source: 'OBSERVED',
        type: 'ORDER_COMPLETED',
        platform: 'Zomato',
        amount: 500,
        currency: 'INR',
        reference: 'REF-GATE-A',
        timestamp: new Date().toISOString(),
        previousHash: 'GENESIS_0000000000000000000000000000000000000000000000000000000000000000',
        integrityHash: 'HASH-GATE-A',
        capturedAt: new Date().toISOString(),
      });

      // Unverified worker runs verification pipeline
      const resUnverified = await request(app)
        .post('/api/v1/verification/run')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({
          payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
        });

      expect(resUnverified.status).toBe(200);
      expect(resUnverified.body.identityVerified).toBe(false);

      // Now verify identity for Worker A
      await IdentityVerification.create({
        workerId: 'OS-WORKER-GATE-A',
        provider: 'SETU_DIGILOCKER',
        requestId: 'req-setu-ver-pipe',
        status: 'VERIFIED',
        verifiedAt: new Date(),
      });

      // Verified worker runs verification pipeline
      const resVerified = await request(app)
        .post('/api/v1/verification/run')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({
          payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
        });

      expect(resVerified.status).toBe(200);
      expect(resVerified.body.identityVerified).toBe(true);
    });
  });
});
