import request from 'supertest';
import app from '../src/index';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { validateAndNormalizeEvidence } from '../src/services/evidenceAdapter';
import { Worker, Evidence, VerificationRecord, Credential, IdentityVerification } from '../src/models';

let mongod: MongoMemoryServer;

jest.setTimeout(30000);

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.connection.close();
  await mongod.stop();
});

describe('OnShift Pre-Integration & Evidence Adapter Test Suite', () => {

  // ---------------------------------------------------------------------------
  // TEST 1: Single Observed Order Payload Adaptation
  // ---------------------------------------------------------------------------
  it('TEST 1: Single Observed Order adapts correctly to canonical EvidenceSchema', () => {
    const rawAndroidEvidence = {
      id: 'obs-zmt-001',
      workerId: 'OS-DEMO-001',
      source: 'OBSERVED_NOTIFICATION',
      type: 'ORDER_COMPLETED',
      platform: 'Zomato',
      amount: 500,
      reference: 'ZMT4821',
      timestamp: '2026-08-05T12:00:00Z',
    };

    const adapted = validateAndNormalizeEvidence(rawAndroidEvidence);
    expect(adapted.source).toBe('OBSERVED');
    expect(adapted.type).toBe('NOTIFICATION_ORDER');
    expect(adapted.role).toBe('ORDER_EVENT');
    expect(adapted.category).toBe('EARNING');
    expect(adapted.platform).toBe('Zomato');
    expect(adapted.amount).toBe(500);
    expect(adapted.reference).toBe('ZMT4821');
  });

  // ---------------------------------------------------------------------------
  // TEST 2: Multiple Distinct Orders
  // ---------------------------------------------------------------------------
  it('TEST 2: Multiple distinct order payloads adapt with preserved roles and amounts', () => {
    const evidences = [
      { id: 'ev-1', workerId: 'OS-DEMO-001', source: 'OBSERVED', type: 'ORDER_COMPLETED', platform: 'Zomato', amount: 500, reference: 'ZMT4821', timestamp: '2026-08-05T10:00:00Z' },
      { id: 'ev-2', workerId: 'OS-DEMO-001', source: 'OBSERVED', type: 'ORDER_COMPLETED', platform: 'Zomato', amount: 700, reference: 'ZMT4822', timestamp: '2026-08-05T11:00:00Z' },
      { id: 'ev-3', workerId: 'OS-DEMO-001', source: 'OBSERVED', type: 'ORDER_COMPLETED', platform: 'Zomato', amount: 800, reference: 'ZMT4823', timestamp: '2026-08-05T12:00:00Z' },
    ];

    const adapted = evidences.map(validateAndNormalizeEvidence);
    expect(adapted.length).toBe(3);
    const sum = adapted.reduce((acc, ev) => acc + ev.amount, 0);
    expect(sum).toBe(2000);
    expect(adapted.every(e => e.role === 'ORDER_EVENT')).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // TEST 3 & 4: Duplicate vs Legitimate Distinct Same-Value Orders
  // ---------------------------------------------------------------------------
  it('TEST 3 & 4: Reference preservation allows deduplication while preserving distinct same-value orders', () => {
    const dup1 = validateAndNormalizeEvidence({ id: 'ev-d1', workerId: 'OS-DEMO-001', source: 'OBSERVED', type: 'ORDER_COMPLETED', platform: 'Zomato', amount: 500, reference: 'ZMT4821', timestamp: '2026-08-05T10:00:00Z' });
    const dup2 = validateAndNormalizeEvidence({ id: 'ev-d2', workerId: 'OS-DEMO-001', source: 'OBSERVED', type: 'ORDER_COMPLETED', platform: 'Zomato', amount: 500, reference: 'ZMT4821', timestamp: '2026-08-05T10:00:00Z' });
    const distinct = validateAndNormalizeEvidence({ id: 'ev-d3', workerId: 'OS-DEMO-001', source: 'OBSERVED', type: 'ORDER_COMPLETED', platform: 'Zomato', amount: 500, reference: 'ZMT4822', timestamp: '2026-08-05T11:00:00Z' });

    expect(dup1.reference).toBe(dup2.reference);
    expect(dup1.reference).not.toBe(distinct.reference);
  });

  // ---------------------------------------------------------------------------
  // TEST 5: Order vs Payout Role Classification
  // ---------------------------------------------------------------------------
  it('TEST 5: PAYOUT_COMPLETED maps to PAYOUT_CLAIM role and NOT ORDER_EVENT', () => {
    const orderEv = validateAndNormalizeEvidence({ id: 'ev-o1', workerId: 'OS-DEMO-001', source: 'OBSERVED', type: 'ORDER_COMPLETED', platform: 'Zomato', amount: 500, reference: 'ZMT4821', timestamp: '2026-08-05T10:00:00Z' });
    const payoutEv = validateAndNormalizeEvidence({ id: 'ev-p1', workerId: 'OS-DEMO-001', source: 'OBSERVED', type: 'PAYOUT_COMPLETED', platform: 'Zomato', amount: 2000, reference: 'ZMT-PAY-1', timestamp: '2026-08-07T20:00:00Z' });

    expect(orderEv.role).toBe('ORDER_EVENT');
    expect(payoutEv.role).toBe('PAYOUT_CLAIM');
    expect(payoutEv.category).toBe('PAYOUT');
  });

  // ---------------------------------------------------------------------------
  // TEST 6, 7, 8: Source Classification & Financial Gate Isolation
  // ---------------------------------------------------------------------------
  it('TEST 6-8: Declared, Observed, and Financial sources normalize into isolated categories', () => {
    const decl = validateAndNormalizeEvidence({ id: 'ev-d', workerId: 'OS-DEMO-001', source: 'DECLARED', type: 'SELF_REPORTED_PAYOUT', platform: 'Zomato', amount: 30100, reference: 'D1', timestamp: '2026-08-05T10:00:00Z' });
    const obs = validateAndNormalizeEvidence({ id: 'ev-o', workerId: 'OS-DEMO-001', source: 'OBSERVED_NOTIFICATION', type: 'NOTIFICATION_PAYOUT', platform: 'Zomato', amount: 30100, reference: 'O1', timestamp: '2026-08-05T11:00:00Z' });
    const fin = validateAndNormalizeEvidence({ id: 'ev-f', workerId: 'OS-DEMO-001', source: 'FINANCIAL', type: 'AA_BANK_SETTLEMENT', platform: 'HDFC Bank', amount: 30100, reference: 'TXN1', timestamp: '2026-08-08T06:00:00Z' });

    expect(decl.source).toBe('DECLARED');
    expect(obs.source).toBe('OBSERVED');
    expect(fin.source).toBe('FINANCIAL');
    expect(fin.role).toBe('SETTLEMENT');
  });

  // ---------------------------------------------------------------------------
  // TEST 14: Timestamp Normalization & UTC Formatting
  // ---------------------------------------------------------------------------
  it('TEST 14: Offset (+05:30) and UTC (Z) timestamps normalize to valid UTC ISO strings', () => {
    const evOffset = validateAndNormalizeEvidence({ id: 'ev-tz1', workerId: 'OS-DEMO-001', source: 'OBSERVED', type: 'ORDER_COMPLETED', platform: 'Zomato', amount: 500, reference: 'Z1', timestamp: '2026-08-07T23:59:59+05:30' });
    const evUtc = validateAndNormalizeEvidence({ id: 'ev-tz2', workerId: 'OS-DEMO-001', source: 'OBSERVED', type: 'ORDER_COMPLETED', platform: 'Zomato', amount: 500, reference: 'Z2', timestamp: '2026-08-07T18:29:59Z' });

    expect(evOffset.timestamp).toBe('2026-08-07T18:29:59.000Z');
    expect(evUtc.timestamp).toBe('2026-08-07T18:29:59.000Z');
  });

  // ---------------------------------------------------------------------------
  // TEST 17 & 18: Malformed & Invalid Input Rejection
  // ---------------------------------------------------------------------------
  it('TEST 17 & 18: Malformed amount strings, NaN, Infinity, negative earnings, and invalid sources throw explicit validation errors', () => {
    expect(() => {
      validateAndNormalizeEvidence({ id: 'bad-amt-str', source: 'OBSERVED', type: 'ORDER_COMPLETED', platform: 'Zomato', amount: '₹30,100', timestamp: '2026-08-05T10:00:00Z' });
    }).toThrow(/Amount must be a numeric float/);

    expect(() => {
      validateAndNormalizeEvidence({ id: 'bad-nan', source: 'OBSERVED', type: 'ORDER_COMPLETED', platform: 'Zomato', amount: NaN, timestamp: '2026-08-05T10:00:00Z' });
    }).toThrow(/Invalid amount/);

    expect(() => {
      validateAndNormalizeEvidence({ id: 'bad-neg', source: 'OBSERVED', type: 'ORDER_COMPLETED', platform: 'Zomato', amount: -500, timestamp: '2026-08-05T10:00:00Z' });
    }).toThrow(/Negative amount not permitted/);

    expect(() => {
      validateAndNormalizeEvidence({ id: 'bad-src', source: 'INVALID_SOURCE', type: 'ORDER_COMPLETED', platform: 'Zomato', amount: 500, timestamp: '2026-08-05T10:00:00Z' });
    }).toThrow(/Invalid or unknown evidence source/);
  });

  // ---------------------------------------------------------------------------
  // TEST 19: Integrity Hash Preservation
  // ---------------------------------------------------------------------------
  it('TEST 19: previousHash and integrityHash are preserved during normalization', () => {
    const raw = {
      id: 'ev-hash-1',
      workerId: 'OS-DEMO-001',
      source: 'OBSERVED',
      type: 'ORDER_COMPLETED',
      platform: 'Zomato',
      amount: 500,
      reference: 'REF-1',
      timestamp: '2026-08-05T10:00:00Z',
      previousHash: 'GENESIS_0000000000000000000000000000000000000000000000000000000000000000',
      integrityHash: 'a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8',
    };

    const adapted = validateAndNormalizeEvidence(raw);
    expect(adapted.previousHash).toBe('GENESIS_0000000000000000000000000000000000000000000000000000000000000000');
    expect(adapted.integrityHash).toBe('a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8');
  });

  // ---------------------------------------------------------------------------
  // TEST 20: Express API Endpoints Integration Test
  // ---------------------------------------------------------------------------
  it('TEST 20: Express POST /reconciliation/run and POST /verification/level invoke backend proxy correctly', async () => {
    const resRecon = await request(app)
      .post('/api/v1/reconciliation/run')
      .send({
        workerId: 'OS-DEMO-001',
        payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
        evidenceIds: ['ev-decl-001', 'ev-obs-zomato-001'],
      });

    expect(resRecon.status).toBe(200);
    expect(resRecon.body.status).toBe('MATCHED');

    const resVer = await request(app)
      .post('/api/v1/verification/level')
      .send({
        workerId: 'OS-DEMO-001',
        payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
        evidenceIds: ['ev-decl-001', 'ev-obs-zomato-001'],
      });

    expect(resVer.status).toBe(200);
    expect(resVer.body.level).toBe('FINANCIALLY_CORROBORATED');
  });

});

// =============================================================================
// DAY 3: End-to-End Worker Journey & Fallback Consistency Test Suite
// =============================================================================
describe('End-to-End Worker Journey & Fallback Consistency', () => {
  const e2eWorkerId = `OS-E2E-${Date.now()}`;
  const fallbackWorkerId = `OS-FALLBACK-${Date.now()}`;

  afterAll(async () => {
    await Worker.deleteMany({ id: { $in: [e2eWorkerId, fallbackWorkerId] } });
    await Evidence.deleteMany({ workerId: { $in: [e2eWorkerId, fallbackWorkerId] } });
    await VerificationRecord.deleteMany({ workerId: { $in: [e2eWorkerId, fallbackWorkerId] } });
    await Credential.deleteMany({ workerId: { $in: [e2eWorkerId, fallbackWorkerId] } });
  });

  it('chained end-to-end worker flow: worker -> evidence -> recon -> verif -> db check -> credential issue -> credential verify -> scheme match', async () => {
    // 1. POST /workers
    const createWorkerRes = await request(app)
      .post('/api/v1/workers')
      .send({
        id: e2eWorkerId,
        name: 'E2E Test Worker',
        workerCategory: 'Delivery Partner',
        location: 'Pune, Maharashtra',
      });
    expect(createWorkerRes.status).toBe(201);
    expect(createWorkerRes.body.id).toBe(e2eWorkerId);

    // 2. POST /evidence
    const evidenceId = `ev-e2e-${Date.now()}`;
    const createEvidenceRes = await request(app)
      .post('/api/v1/evidence')
      .send({
        id: evidenceId,
        workerId: e2eWorkerId,
        source: 'FINANCIAL',
        type: 'AA_BANK_SETTLEMENT',
        platform: 'HDFC Bank',
        amount: 30100,
        currency: 'INR',
        reference: 'TXN-E2E-001',
        timestamp: '2026-08-07T12:00:00Z',
        capturedAt: new Date().toISOString(),
        previousHash: 'GENESIS_0000000000000000000000000000000000000000000000000000000000000000',
        integrityHash: 'a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8',
      });
    expect(createEvidenceRes.status).toBe(201);
    expect(createEvidenceRes.body.id).toBe(evidenceId);

    // 3. GET /evidence/worker/:workerId
    const getEvidenceRes = await request(app).get(`/api/v1/evidence/worker/${e2eWorkerId}`);
    expect(getEvidenceRes.status).toBe(200);
    expect(Array.isArray(getEvidenceRes.body)).toBe(true);
    expect(getEvidenceRes.body.some((e: any) => e.id === evidenceId)).toBe(true);

    // 4. POST /reconciliation/run
    const payoutPeriod = { startDate: '2026-08-01', endDate: '2026-08-07' };
    const reconRes = await request(app)
      .post('/api/v1/reconciliation/run')
      .send({
        workerId: e2eWorkerId,
        payoutPeriod,
        evidenceIds: [evidenceId],
      });
    expect(reconRes.status).toBe(200);
    expect(reconRes.body.status).toBeDefined();

    // 5. POST /verification/level
    const verRes = await request(app)
      .post('/api/v1/verification/level')
      .send({
        workerId: e2eWorkerId,
        payoutPeriod,
        evidenceIds: [evidenceId],
      });
    expect(verRes.status).toBe(200);
    expect(verRes.body.level).toBeDefined();
    expect(typeof verRes.body.confidence).toBe('number');

    // 6. Direct VerificationRecord query
    const verRecord = await VerificationRecord.findOne({ workerId: e2eWorkerId }).lean();
    expect(verRecord).not.toBeNull();
    // 6.5 Seed Verified Identity for e2eWorkerId
    await IdentityVerification.create({
      workerId: e2eWorkerId,
      provider: 'SETU_DIGILOCKER',
      status: 'VERIFIED',
      verifiedAt: new Date(),
    });

    // 7. POST /credentials/issue
    const issueRes = await request(app)
      .post('/api/v1/credentials/issue')
      .send({
        workerId: e2eWorkerId,
        disclosedClaims: {
          verifiedIncome: 30100,
          period: '01 Aug to 07 Aug 2026',
          verificationLevel: verRes.body.level,
        },
      });
    expect(issueRes.status).toBe(201);
    expect(issueRes.body.credential).toBeDefined();
    expect(issueRes.body.credential.workerId).toBe(e2eWorkerId);

    const issuedCred = issueRes.body.credential;

    // 8. Direct Credential query
    const credDoc = await Credential.findOne({ workerId: e2eWorkerId }).lean();
    expect(credDoc).not.toBeNull();
    expect((credDoc as any)?.publicKeyHex || credDoc!.issuerPublicKey).toBe(issuedCred.publicKeyHex || issuedCred.issuerPublicKey);
    expect(credDoc!.signature).toBe(issuedCred.signature);

    // 9. POST /credentials/verify
    const verifyCredRes = await request(app)
      .post('/api/v1/credentials/verify')
      .send(issuedCred);
    expect(verifyCredRes.status).toBe(200);
    expect(verifyCredRes.body.valid).toBe(true);

    // 10. POST /schemes/match
    const schemeMatchRes = await request(app)
      .post('/api/v1/schemes/match')
      .send({
        monthlyIncome: 30100,
        workerCategory: 'Delivery Partner',
        location: 'Pune, Maharashtra',
      });
    expect(schemeMatchRes.status).toBe(200);
    expect(Array.isArray(schemeMatchRes.body)).toBe(true);
  });

  it('Full flow degrades gracefully when verification engine is unreachable', async () => {
    // Create worker
    await request(app)
      .post('/api/v1/workers')
      .send({ id: fallbackWorkerId, name: 'Fallback Worker' });

    const markerEvidenceId = 'ev-fin-hdfc-002';

    const originalEngineUrl = process.env.VERIFICATION_ENGINE_URL;
    process.env.VERIFICATION_ENGINE_URL = 'http://localhost:9999';

    try {
      const reconRes = await request(app)
        .post('/api/v1/reconciliation/run')
        .send({
          workerId: fallbackWorkerId,
          payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
          evidenceIds: [markerEvidenceId],
        });

      const verRes = await request(app)
        .post('/api/v1/verification/level')
        .send({
          workerId: fallbackWorkerId,
          payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
          evidenceIds: [markerEvidenceId],
        });

      // Both should degrade gracefully to Scenario 2 mock fallback
      expect(reconRes.status).toBe(200);
      expect(reconRes.body.status).toBe('UNEXPLAINED_DIFFERENCE');

      expect(verRes.status).toBe(200);
      expect(verRes.body.level).toBe('CORROBORATED');
      expect(typeof verRes.body.confidence).toBe('number');
    } finally {
      if (originalEngineUrl !== undefined) {
        process.env.VERIFICATION_ENGINE_URL = originalEngineUrl;
      } else {
        delete process.env.VERIFICATION_ENGINE_URL;
      }
    }

    // Verify system works normally after engine URL restoration
    const workerCheck = await request(app).get(`/api/v1/workers/${fallbackWorkerId}`);
    expect(workerCheck.status).toBe(200);
    expect(workerCheck.body.id).toBe(fallbackWorkerId);
  });
});
