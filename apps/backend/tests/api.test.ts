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
import { VerificationRecord, Credential, IdentityVerification } from '../src/models';
import { Worker } from '../src/models/Worker';
import { issueCredential, verifyCredential } from '../src/services/credentialService';

let mongod: MongoMemoryServer;
let originalEngineUrl: string | undefined;

jest.setTimeout(30000);

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
  // Ensure unique indexes (e.g. Worker.id) are built before tests run.
  await Worker.ensureIndexes();
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

  it('POST /api/v1/workers with duplicate id returns 409', async () => {
    const duplicateId = `OS-DUPLICATE-${Date.now()}`;
    await Worker.create({ id: duplicateId, name: 'Pre-seeded Worker' });
    const res = await request(app)
      .post('/api/v1/workers')
      .send({ id: duplicateId, name: 'Duplicate Worker' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('CONFLICT');
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
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.message).toBe('Request validation failed.');
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'integrityHash' })])
    );
  });
});

// =============================================================================
// P1. Request validation and centralized errors
// =============================================================================
describe('Request validation and error responses', () => {
  it('rejects an invalid worker payload with structured field details', async () => {
    const res = await request(app).post('/api/v1/workers').send({ id: '   ' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'VALIDATION_ERROR',
      message: 'Request validation failed.',
      details: expect.arrayContaining([expect.objectContaining({ field: 'id' })]),
    });
  });

  it('rejects verification requests with an invalid payout period', async () => {
    const res = await request(app).post('/api/v1/verification/level').send({
      workerId: 'OS-TEST-VALIDATION',
      evidenceIds: [],
      payoutPeriod: { startDate: '2026-08-08', endDate: '2026-08-01' },
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'evidenceIds' }),
        expect.objectContaining({ field: 'payoutPeriod' }),
      ])
    );
  });

  it('rejects credential issuance with an invalid verification level', async () => {
    const res = await request(app).post('/api/v1/credentials/issue').send({
      workerId: 'OS-TEST-VALIDATION',
      disclosedClaims: {
        verifiedIncome: 30100,
        period: '01 Aug to 07 Aug 2026',
        verificationLevel: 'UNVERIFIED',
      },
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'disclosedClaims.verificationLevel' })])
    );
  });

  it('rejects malformed consent and scheme-match payloads', async () => {
    const [consentResponse, schemeResponse] = await Promise.all([
      request(app).post('/api/v1/consent/request').send({ aaProvider: 'Finvu Sandbox' }),
      request(app).post('/api/v1/schemes/match').send({ monthlyIncome: -1 }),
    ]);

    expect(consentResponse.status).toBe(400);
    expect(consentResponse.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'workerId' })])
    );
    expect(schemeResponse.status).toBe(400);
    expect(schemeResponse.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'monthlyIncome' })])
    );
  });

  it('returns a consistent 404 response for an unknown route', async () => {
    const res = await request(app).get('/api/v1/not-a-route');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
    expect(res.body.message).toMatch(/was not found/i);
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
    const lastChar = credential.signature.slice(-1);
    const newChar = lastChar.toLowerCase() === 'a' ? '0' : 'a';
    const mutated = {
      ...credential,
      signature: credential.signature.slice(0, -1) + newChar,
    };

    const res = await request(app)
      .post('/api/v1/credentials/verify')
      .send(mutated);
    if (res.status !== 200) {
      console.log('Verify Error Response:', JSON.stringify(res.body, null, 2));
    }
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

  it('POST /api/v1/credentials/issue returns 201 with aligned keys and persists to MongoDB', async () => {
    const issueWorkerId = `OS-ISSUE-${Date.now()}`;
    await IdentityVerification.create({
      workerId: issueWorkerId,
      provider: 'SETU_DIGILOCKER',
      status: 'VERIFIED',
      verifiedAt: new Date(),
    });
    const res = await request(app)
      .post('/api/v1/credentials/issue')
      .send({
        workerId: issueWorkerId,
        disclosedClaims: {
          verifiedIncome: 30100,
          period: '01 Aug to 07 Aug 2026',
          verificationLevel: 'FINANCIALLY_CORROBORATED',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.credential).toBeDefined();
    const cred = res.body.credential;
    expect(cred.type).toBe('OnShiftIncomeCredential');
    expect(cred.issuer).toBe('OnShift Proof Authority');
    expect(cred.publicKeyHex).toBeDefined();
    expect(cred.workerId).toBe(issueWorkerId);
    expect(cred.issuedAt).toBeDefined();
    expect(cred.validUntil).toBeDefined();
    expect(cred.signature).toBeDefined();
    expect(cred.claims.verifiedIncome).toBe(30100);

    const savedDoc = await Credential.findOne({ workerId: issueWorkerId });
    expect(savedDoc).not.toBeNull();
    expect(savedDoc!.publicKeyHex).toBe(cred.publicKeyHex);
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

// =============================================================================
// 11. Account Aggregator Consent Flow
// =============================================================================
describe('Account Aggregator Consent Flow', () => {
  it('POST /api/v1/consent/request returns 201 with consentId and isMock label', async () => {
    const res = await request(app)
      .post('/api/v1/consent/request')
      .send({ workerId: 'OS-AA-TEST', aaProvider: 'Setu Mock AA' });

    expect(res.status).toBe(201);
    expect(res.body.consentId).toMatch(/^AA-CONSENT-/);
    expect(res.body.isMock).toBe(true);
    expect(res.body.authorizationUrl).toContain(res.body.consentId);
  });

  it('GET /api/v1/consent/status/:consentId returns 200 for stored consent and 404 for nonexistent ID', async () => {
    const requestRes = await request(app)
      .post('/api/v1/consent/request')
      .send({ workerId: 'OS-AA-TEST-2', aaProvider: 'Setu Mock AA' });

    const consentId = requestRes.body.consentId;
    const res = await request(app).get(`/api/v1/consent/status/${consentId}`);

    expect(res.status).toBe(200);
    expect(res.body.consentId).toBe(consentId);
    expect(res.body.status).toBe('PENDING');
    expect(res.body.isMock).toBe(true);

    const res404 = await request(app).get('/api/v1/consent/status/nonexistent-id-12345');
    expect(res404.status).toBe(404);
    expect(res404.body.error).toBe('Consent request not found.');
  });

  it('POST /api/v1/consent/request with invalid fiTypes returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/consent/request')
      .send({ workerId: 'OS-AA-TEST-3', fiTypes: ['NOT_A_REAL_TYPE'] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'fiTypes',
          issue: 'fiTypes must be an array of valid AA financial information types.',
        }),
      ])
    );
  });
});


