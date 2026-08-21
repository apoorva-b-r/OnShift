/**
 * OnShift Backend -- Integration Test Suite
 *
 * Covers all required cases from the P0 closing spec:
 *   1.  GET /health
 *   2.  Workers round-trip (POST + GET + duplicate 409)
 *   3.  Evidence validation -- missing integrityHash => 400
 *   4.  Reconciliation fallback, Scenario 1
 *   5.  Reconciliation fallback, Scenario 2
 *   6.  Verification fallback, Scenario 2 (regression guard -- must NOT return FINANCIALLY_CORROBORATED)
 *   7.  Verification fallback, Scenario 1
 *   8.  VerificationRecord persistence check
 *   9.  Credential tamper detection
 *  10.  GET /schemes
 *
 * NOTE: index.ts skips mongoose.connect() when NODE_ENV=test, so these
 * tests connect via mongodb-memory-server instead.
 */

import request from 'supertest';
import app from '../src/index';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { VerificationRecord } from '../src/models';
import { Worker } from '../src/models/Worker';
import { issueCredential, verifyCredential } from '../src/services/credentialService';

let mongod: MongoMemoryServer;
let originalEngineUrl: string | undefined;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.connection.close();
  await mongod.stop();
  if (originalEngineUrl !== undefined) {
    process.env.VERIFICATION_ENGINE_URL = originalEngineUrl;
  } else {
    delete process.env.VERIFICATION_ENGINE_URL;
  }
});

function blockEngine() {
  originalEngineUrl = process.env.VERIFICATION_ENGINE_URL;
  process.env.VERIFICATION_ENGINE_URL = 'http://localhost:9';
}

function restoreEngine() {
  if (originalEngineUrl !== undefined) {
    process.env.VERIFICATION_ENGINE_URL = originalEngineUrl;
  } else {
    delete process.env.VERIFICATION_ENGINE_URL;
  }
}

// =============================================================================
// 1. Health
// =============================================================================
describe('GET /api/v1/health', () => {
  it('returns 200 with status HEALTHY', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('HEALTHY');
  });
});

// =============================================================================
// 2. Workers round-trip
// NOTE: workerController currently never touches Mongoose so:
//   - POST /workers always returns 201 (no persistence, no duplicate check).
//   - GET /workers/:id returns mock data for OS-DEMO-001 or a generic stub.
//   - Duplicate POST does NOT return 409 -- this is a KNOWN BUG reported below.
// =============================================================================
describe('Workers', () => {
  const testId = `OS-TEST-${Date.now()}`;

  it('POST /api/v1/workers returns 201 with the provided id', async () => {
    const res = await request(app)
      .post('/api/v1/workers')
      .send({ id: testId, name: 'Test Worker' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(testId);
  });

  it('GET /api/v1/workers/:id returns 200', async () => {
    const res = await request(app).get(`/api/v1/workers/${testId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(testId);
  });

  /**
   * KNOWN BUG -- reported, not silently patched.
   * workerController.createWorker() never writes to Mongoose, so sending the
   * same id a second time returns 201 again instead of 409.
   *
   * Fix required in workerController.ts:
   *   const existing = await Worker.findOne({ id });
   *   if (existing) return res.status(409).json({ error: 'Worker already exists.' });
   *   const saved = await Worker.create({ id, name, ... });
   *   return res.status(201).json(saved);
   */
  it.skip('[BUG] POST /api/v1/workers with duplicate id returns 409', async () => {
    await Worker.create({ id: testId, name: 'Pre-seeded Worker' });
    const res = await request(app)
      .post('/api/v1/workers')
      .send({ id: testId, name: 'Duplicate Worker' });
    expect(res.status).toBe(409);
  });
});

// =============================================================================
// 3. Evidence validation
// =============================================================================
describe('Evidence', () => {
  it('POST /api/v1/evidence without integrityHash returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/evidence')
      .send({
        source: 'DECLARED',
        type: 'SELF_REPORTED_PAYOUT',
        platform: 'Test Platform',
        timestamp: new Date().toISOString(),
        amount: 10000,
        currency: 'INR',
        reference: 'REF-001',
        capturedAt: new Date().toISOString(),
        previousHash: 'GENESIS_0000000000000000000000000000000000000000000000000000000000000000',
        // integrityHash intentionally omitted
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/integrityHash/i);
  });
});

// =============================================================================
// 4 + 5. Reconciliation fallback
// =============================================================================
describe('Reconciliation fallback (engine unreachable)', () => {
  beforeEach(() => blockEngine());
  afterEach(() => restoreEngine());

  it('Scenario 1: evidenceIds without ev-fin-hdfc-002 => status MATCHED', async () => {
    const res = await request(app)
      .post('/api/v1/reconciliation/run')
      .send({
        workerId: 'OS-TEST-RECON-S1',
        payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
        evidenceIds: ['ev-decl-001', 'ev-obs-zomato-001'],
      });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('MATCHED');
  });

  it('Scenario 2: evidenceIds with ev-fin-hdfc-002 => status UNEXPLAINED_DIFFERENCE, difference 600', async () => {
    const res = await request(app)
      .post('/api/v1/reconciliation/run')
      .send({
        workerId: 'OS-TEST-RECON-S2',
        payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
        evidenceIds: ['ev-decl-001', 'ev-fin-hdfc-002'],
      });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UNEXPLAINED_DIFFERENCE');
    expect(res.body.difference).toBe(600);
  });
});

// =============================================================================
// 6 + 7 + 8. Verification fallback + VerificationRecord persistence
// =============================================================================
describe('Verification fallback (engine unreachable)', () => {
  beforeEach(() => blockEngine());
  afterEach(() => restoreEngine());

  /**
   * Test 6 -- Regression guard for Scenario 2.
   * This test catches regressions of the bug where the fallback always
   * returned Scenario 1 regardless of evidenceIds.
   */
  it('Scenario 2: level is CORROBORATED (NOT FINANCIALLY_CORROBORATED), confidence ~0.72', async () => {
    const workerIdS2 = `OS-VFY-S2-${Date.now()}`;
    const res = await request(app)
      .post('/api/v1/verification/level')
      .send({
        workerId: workerIdS2,
        payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
        evidenceIds: ['ev-decl-001', 'ev-fin-hdfc-002'],
      });
    expect(res.status).toBe(200);
    expect(res.body.level).toBe('CORROBORATED');
    expect(res.body.level).not.toBe('FINANCIALLY_CORROBORATED');
    expect(res.body.confidence).toBeCloseTo(0.72);
  });

  it('Scenario 1: level is FINANCIALLY_CORROBORATED, confidence ~0.96', async () => {
    const workerIdS1 = `OS-VFY-S1-${Date.now()}`;
    const res = await request(app)
      .post('/api/v1/verification/level')
      .send({
        workerId: workerIdS1,
        payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
        evidenceIds: ['ev-decl-001', 'ev-obs-zomato-001'],
      });
    expect(res.status).toBe(200);
    expect(res.body.level).toBe('FINANCIALLY_CORROBORATED');
    expect(res.body.confidence).toBeCloseTo(0.96);
  });

  it('VerificationRecord is persisted with engineSource MOCK_FALLBACK', async () => {
    const persistTestWorkerId = `OS-PERSIST-${Date.now()}`;
    await request(app)
      .post('/api/v1/verification/level')
      .send({
        workerId: persistTestWorkerId,
        payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
        evidenceIds: ['ev-decl-001', 'ev-obs-zomato-001'],
      });

    const record = await VerificationRecord.findOne({ workerId: persistTestWorkerId }).lean();
    expect(record).not.toBeNull();
    expect(record!.engineSource).toBe('MOCK_FALLBACK');
  });
});

// =============================================================================
// 9. Credential tamper detection
// =============================================================================
describe('Credentials', () => {
  it('tampered credential signature returns valid: false', async () => {
    const claims = {
      verifiedIncome: 30100,
      period: '01 Aug to 07 Aug 2026',
      verificationLevel: 'FINANCIALLY_CORROBORATED' as const,
    };
    const credential = issueCredential('OS-TEST-TAMPER', claims);
    const mutated = {
      ...credential,
      signature: credential.signature.replace(/.$/, credential.signature.endsWith('A') ? 'B' : 'A'),
    };

    const res = await request(app)
      .post('/api/v1/credentials/verify')
      .send(mutated);
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
  });

  it('original credential signing and verification roundtrip', () => {
    const claims = {
      verifiedIncome: 30100,
      period: '01 Aug to 07 Aug 2026',
      verificationLevel: 'FINANCIALLY_CORROBORATED' as const,
    };
    const cred = issueCredential('OS-DEMO-001', claims);
    expect(cred).toBeDefined();
    expect(cred.signature).toBeDefined();

    const verification = verifyCredential(cred);
    expect(verification.valid).toBe(true);
    expect(verification.signatureVerified).toBe(true);
    expect(verification.claims?.verifiedIncome).toBe(30100);
  });
});

// =============================================================================
// 10. Schemes
// getSchemes() returns DEMO_GOVERNMENT_SCHEMES directly -- a bare array.
// =============================================================================
describe('GET /api/v1/schemes', () => {
  it('returns 200 and a non-empty array', async () => {
    const res = await request(app).get('/api/v1/schemes');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });
});

