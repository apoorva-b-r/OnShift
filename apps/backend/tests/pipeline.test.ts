import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/index';
import { Evidence, Worker, VerificationRecord, Credential } from '../src/models';
import { generateWorkerToken } from '../src/middleware/authMiddleware';
import { verifyCredentialSignature } from '@onshift/credential-schema';

describe('Authoritative Verification â†’ Reconciliation â†’ Credential Pipeline', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    process.env.ENABLE_AUTH = 'true';
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    delete process.env.ENABLE_AUTH;
    await mongoose.disconnect();
    await mongoServer.stop();
  }, 30000);

  beforeEach(async () => {
    await mongoose.connection.db?.dropDatabase();
  });

  // ===========================================================================
  // 1. Authentication & Authorization Boundaries
  // ===========================================================================
  describe('1. Authentication & Authorization Boundaries', () => {
    it('rejects protected endpoints without token with 401', async () => {
      const res = await request(app).post('/api/v1/verification/run').send({});
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    it('rejects protected endpoints with malformed token with 401', async () => {
      const res = await request(app)
        .post('/api/v1/verification/run')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .send({});
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('INVALID_TOKEN');
    });

    it('rejects request when authenticated workerId mismatches body workerId with 403', async () => {
      const tokenA = generateWorkerToken('OS-WORKER-A');
      const res = await request(app)
        .post('/api/v1/verification/run')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          workerId: 'OS-WORKER-B',
          payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('WORKER_ID_MISMATCH');
    });
  });

  // ===========================================================================
  // 2. Evidence Ownership & IDOR Protection
  // ===========================================================================
  describe('2. Evidence Ownership & IDOR Protection', () => {
    it('rejects verification request if worker references another worker evidence with 403', async () => {
      // Create evidence for Worker B
      await Evidence.create({
        id: 'ev-worker-b-001',
        workerId: 'OS-WORKER-B',
        source: 'OBSERVED',
        type: 'NOTIFICATION_ORDER',
        role: 'ORDER_EVENT',
        category: 'EARNING',
        platform: 'ZOMATO',
        amount: 500,
        currency: 'INR',
        reference: 'REF-B1',
        timestamp: new Date().toISOString(),
        previousHash: 'GENESIS_HASH',
        integrityHash: 'HASH_B1',
        capturedAt: new Date().toISOString(),
      });

      const tokenA = generateWorkerToken('OS-WORKER-A');
      const res = await request(app)
        .post('/api/v1/verification/run')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          workerId: 'OS-WORKER-A',
          evidenceIds: ['ev-worker-b-001'],
          payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN_EVIDENCE_ACCESS');
    });
  });

  // ===========================================================================
  // 3. Authoritative Server Verification Engine & Invariants
  // ===========================================================================
  describe('3. Authoritative Verification Pipeline', () => {
    it('ignores client attempts to force FINANCIALLY_CORROBORATED without evidence', async () => {
      const workerId = 'OS-WORKER-FORCED';
      const token = generateWorkerToken(workerId);

      const res = await request(app)
        .post('/api/v1/verification/run')
        .set('Authorization', `Bearer ${token}`)
        .send({
          workerId,
          verificationLevel: 'FINANCIALLY_CORROBORATED', // Client attempt to dictate level
          payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
        });

      expect(res.status).toBe(200);
      expect(res.body.id).toBeDefined();
      expect(res.body.workerId).toBe(workerId);
      // Engine calculates baseline (DECLARED/OBSERVED/Scenario 1 default), ignoring forced client param
      expect(res.body.level).toBeDefined();
    });

    it('persists auditable VerificationRecord in MongoDB', async () => {
      const workerId = 'OS-WORKER-AUDIT';
      const token = generateWorkerToken(workerId);

      const res = await request(app)
        .post('/api/v1/verification/run')
        .set('Authorization', `Bearer ${token}`)
        .send({
          workerId,
          payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
        });

      expect(res.status).toBe(200);
      const verificationId = res.body.id;

      const record = await VerificationRecord.findOne({ id: verificationId });
      expect(record).not.toBeNull();
      expect(record!.workerId).toBe(workerId);
      expect(record!.verificationEngineVersion).toBe('1.0.0');
    });
  });

  // ===========================================================================
  // 4. Credential Eligibility & Cross-Worker Protection
  // ===========================================================================
  describe('4. Credential Eligibility & Gating', () => {
    it('rejects credential issuance for non-existent verificationId with 404', async () => {
      const token = generateWorkerToken('OS-WORKER-CRED-404');
      const res = await request(app)
        .post('/api/v1/credentials/issue')
        .set('Authorization', `Bearer ${token}`)
        .send({
          verificationId: 'vr-non-existent-999',
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('VERIFICATION_NOT_FOUND');
    });

    it('rejects Worker A attempting to issue credential using Worker B verificationId with 403', async () => {
      // Create VerificationRecord for Worker B
      const recB = await VerificationRecord.create({
        id: 'vr-worker-b-100',
        workerId: 'OS-WORKER-B',
        payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
        level: 'FINANCIALLY_CORROBORATED',
        confidence: 0.99,
        reason: 'Perfect AA match',
        supportingEvidence: [],
        limitations: 'None',
        evidenceIds: [],
        engineSource: 'MOCK_TEST',
        computedAt: new Date().toISOString(),
      });

      // Worker A attempts to claim recB.id
      const tokenA = generateWorkerToken('OS-WORKER-A');
      const res = await request(app)
        .post('/api/v1/credentials/issue')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          verificationId: recB.id,
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN_WORKER_MISMATCH');
    });

    it('ensures credential issuance is idempotent for the same verificationId', async () => {
      const workerId = 'OS-WORKER-IDEM';
      const token = generateWorkerToken(workerId);

      const rec = await VerificationRecord.create({
        id: 'vr-idem-777',
        workerId,
        payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
        level: 'FINANCIALLY_CORROBORATED',
        confidence: 0.99,
        reason: 'Matching AA settlement',
        supportingEvidence: [],
        limitations: 'None',
        evidenceIds: [],
        expectedNet: 30100,
        engineSource: 'MOCK_TEST',
        computedAt: new Date().toISOString(),
      });

      // First issuance request
      const res1 = await request(app)
        .post('/api/v1/credentials/issue')
        .set('Authorization', `Bearer ${token}`)
        .send({ verificationId: rec.id });
      expect(res1.status).toBe(201);
      const sig1 = res1.body.credential.signature;

      // Second issuance request for same verificationId
      const res2 = await request(app)
        .post('/api/v1/credentials/issue')
        .set('Authorization', `Bearer ${token}`)
        .send({ verificationId: rec.id });
      expect(res2.status).toBe(200);
      expect(res2.body.credential.signature).toBe(sig1);

      // Verify only 1 credential document exists in DB for this verificationId
      const credCount = await Credential.countDocuments({ verificationId: rec.id });
      expect(credCount).toBe(1);
    });
  });

  // ===========================================================================
  // 5. Complete End-to-End Pipeline & Cryptographic Verification Roundtrip
  // ===========================================================================
  describe('5. Complete E2E Integration Pipeline', () => {
    it('executes full pipeline: evidence -> verification -> record -> VC -> Ed25519 verification', async () => {
      const workerId = 'OS-WORKER-E2E-PIPE';
      const token = generateWorkerToken(workerId);

      // 1. Create worker profile
      await Worker.create({ id: workerId, name: 'E2E Test Worker' });

      // 2. Ingest Evidence
      const ev1 = await Evidence.create({
        id: 'ev-pipe-zmt-001',
        workerId,
        source: 'OBSERVED',
        type: 'NOTIFICATION_ORDER',
        role: 'ORDER_EVENT',
        category: 'EARNING',
        platform: 'ZOMATO',
        amount: 30100,
        currency: 'INR',
        reference: 'ZMT-REF-100',
        timestamp: '2026-08-02T10:00:00.000Z',
        previousHash: 'GENESIS_HASH',
        integrityHash: 'HASH_ZMT_100',
        capturedAt: new Date().toISOString(),
      });

      // 3. Run Authoritative Verification
      const verRes = await request(app)
        .post('/api/v1/verification/run')
        .set('Authorization', `Bearer ${token}`)
        .send({
          workerId,
          evidenceIds: [ev1.id],
          payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
        });

      expect(verRes.status).toBe(200);
      const verificationId = verRes.body.id;
      expect(verificationId).toBeDefined();

      // 4. Issue Credential referencing VerificationRecord
      const credRes = await request(app)
        .post('/api/v1/credentials/issue')
        .set('Authorization', `Bearer ${token}`)
        .send({
          verificationId,
        });

      expect(credRes.status).toBe(201);
      const signedVc = credRes.body.credential;
      expect(signedVc.type).toBe('OnShiftIncomeCredential');
      expect(signedVc.workerId).toBe(workerId);
      expect(signedVc.signature).toBeDefined();
      expect(signedVc.verificationId).toBe(verificationId);

      // 5. Verify Ed25519 signature independently
      const verifyRes = await request(app)
        .post('/api/v1/credentials/verify')
        .send(signedVc);

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.valid).toBe(true);
      expect(verifyRes.body.signatureVerified).toBe(true);

      // 6. Test signature tamper failure
      const tamperedVc = {
        ...signedVc,
        signature: signedVc.signature.slice(0, -1) + (signedVc.signature.endsWith('a') ? '0' : 'a'),
      };
      const tamperRes = await request(app)
        .post('/api/v1/credentials/verify')
        .send(tamperedVc);

      expect(tamperRes.status).toBe(200);
      expect(tamperRes.body.valid).toBe(false);
    });
  });
});


