/**
 * auth.test.ts
 *
 * JWT authentication and authorization tests for the OnShift backend.
 *
 * These tests run with ENABLE_AUTH=true to exercise the real auth middleware.
 * Existing tests in api.test.ts and integration.test.ts run with ENABLE_AUTH=false
 * (or rely on the default bypass) and should continue to pass unchanged.
 *
 * Test categories:
 *  1. authenticate middleware — token parsing, signature, expiry, claims
 *  2. enforceWorkerOwnership — body/param/query workerId cross-checking
 *  3. Auth E2E — full worker journey with JWT: Worker A scoped correctly,
 *     Worker A token rejected when used for Worker B data
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import app from '../src/index';
import { Credential, Evidence, Worker, IdentityVerification } from '../src/models';

// ---------------------------------------------------------------------------
// Setup: use a real in-memory MongoDB, set ENABLE_AUTH=true and JWT_SECRET
// ---------------------------------------------------------------------------
const TEST_JWT_SECRET = 'test-jwt-secret-for-auth-tests-minimum-32-chars!!';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  process.env.ENABLE_AUTH = 'true';
  process.env.JWT_SECRET = TEST_JWT_SECRET;

  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  delete process.env.ENABLE_AUTH;
  delete process.env.JWT_SECRET;
}, 30000);

// ---------------------------------------------------------------------------
// Helper: issue test tokens
// ---------------------------------------------------------------------------
function makeToken(
  sub: string,
  role: string = 'WORKER',
  overrides: Partial<jwt.SignOptions & { secret?: string }> = {}
): string {
  const { secret = TEST_JWT_SECRET, ...opts } = overrides;
  return jwt.sign({ sub, role }, secret, {
    algorithm: 'HS256',
    expiresIn: '1h',
    ...opts,
  });
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// ---------------------------------------------------------------------------
// 1. authenticate middleware
// ---------------------------------------------------------------------------
describe('authenticate middleware', () => {
  it('rejects requests with no Authorization header → 401', async () => {
    const res = await request(app).get('/api/v1/workers/OS-TEST-001');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
    expect(res.body.message).toMatch(/Missing Authorization/);
  });

  it('rejects requests with non-Bearer scheme → 401', async () => {
    const res = await request(app)
      .get('/api/v1/workers/OS-TEST-001')
      .set('Authorization', 'Basic dXNlcjpwYXNz');
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Malformed token format|Authorization/);
  });

  it('rejects requests with empty Bearer token → 401', async () => {
    const res = await request(app)
      .get('/api/v1/workers/OS-TEST-001')
      .set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
  });

  it('rejects tokens with bad signature → 401', async () => {
    const badToken = makeToken('OS-TEST-001', 'WORKER', { secret: 'wrong-secret-entirely' });
    const res = await request(app)
      .get('/api/v1/workers/OS-TEST-001')
      .set(authHeader(badToken));
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_TOKEN');;
  });

  it('rejects expired tokens → 401', async () => {
    const expiredToken = makeToken('OS-TEST-001', 'WORKER', { expiresIn: '-1s' });
    const res = await request(app)
      .get('/api/v1/workers/OS-TEST-001')
      .set(authHeader(expiredToken));
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('EXPIRED_TOKEN');
  });

  it('rejects tokens missing sub claim → 401', async () => {
    // Manually craft a token with no sub
    const noSubToken = jwt.sign({ role: 'WORKER' }, TEST_JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
    const res = await request(app)
      .get('/api/v1/workers/OS-TEST-001')
      .set(authHeader(noSubToken));
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/sub/);
  });

  it('accepts tokens with unknown role (normalised to WORKER) -> 200', async () => {
    const badRoleToken = jwt.sign({ sub: 'OS-TEST-001', role: 'SUPERUSER' }, TEST_JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '1h',
    });
    const res = await request(app)
      .get('/api/v1/workers/OS-TEST-001')
      .set(authHeader(badRoleToken));
    // Unknown roles are normalised to WORKER; GET /workers/:id has no requireRole guard
    expect(res.status).toBe(200);
  });

  it('accepts a valid token and returns 200 for GET /workers/:id', async () => {
    const token = makeToken('OS-TEST-001');
    const res = await request(app)
      .get('/api/v1/workers/OS-TEST-001')
      .set(authHeader(token));
    expect([200, 404]).toContain(res.status); // 200 if found, 404 if not (both mean auth passed)
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('health endpoint remains public — no auth required', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('HEALTHY');
  });

  it('credential verify endpoint remains public — no auth required', async () => {
    // Send an intentionally invalid credential body to confirm 400 (validation), not 401 (auth)
    const res = await request(app)
      .post('/api/v1/credentials/verify')
      .send({ foo: 'bar' });
    expect(res.status).toBe(400); // validation error, not auth error
    expect(res.status).not.toBe(401);
  });
});

// ---------------------------------------------------------------------------
// 2. enforceWorkerOwnership
// ---------------------------------------------------------------------------
describe('enforceWorkerOwnership', () => {
  const workerAId = `OS-AUTH-A-${Date.now()}`;
  const workerBId = `OS-AUTH-B-${Date.now()}`;
  const tokenA = makeToken(workerAId);
  const tokenB = makeToken(workerBId);

  it('allows token=A to submit evidence with no body.workerId (derives from token)', async () => {
    const id = `ev-auth-1-${Date.now()}`;
    const ts = '2026-08-07T12:00:00.000Z';
    const prev = 'GENESIS_0000000000000000000000000000000000000000000000000000000000000000';
    const hash = require('crypto').createHash('sha256').update(`${id}|${workerAId}|DECLARED|ZOMATO|100|${ts}|${prev}`).digest('hex');
    const res = await request(app)
      .post('/api/v1/evidence')
      .set(authHeader(tokenA))
      .send({
        id,
        source: 'DECLARED',
        type: 'SELF_DECLARED',
        platform: 'ZOMATO',
        amount: 100,
        currency: 'INR',
        reference: 'REF-001',
        timestamp: ts,
        capturedAt: ts,
        previousHash: prev,
        integrityHash: hash,
      });
    expect(res.status).toBe(201);
    // workerId in response must come from token A, not from body
    expect(res.body.workerId).toBe(workerAId);
  });

  it('allows token=A with body.workerId=A (matching)', async () => {
    // Use a fresh worker so hash chain starts at GENESIS (independent of test 1)
    const workerAId2 = `OS-AUTH-A2-${Date.now()}`;
    const tokenA2 = makeToken(workerAId2);
    const id = `ev-auth-2-${Date.now()}`;
    const ts = '2026-08-07T12:00:00.000Z';
    const prev = 'GENESIS_0000000000000000000000000000000000000000000000000000000000000000';
    const hash = require('crypto').createHash('sha256').update(`${id}|${workerAId2}|DECLARED|ZOMATO|100|${ts}|${prev}`).digest('hex');
    const res = await request(app)
      .post('/api/v1/evidence')
      .set(authHeader(tokenA2))
      .send({
        id,
        workerId: workerAId2,
        source: 'DECLARED',
        type: 'SELF_DECLARED',
        platform: 'ZOMATO',
        amount: 100,
        currency: 'INR',
        reference: 'REF-002',
        timestamp: ts,
        capturedAt: ts,
        previousHash: prev,
        integrityHash: hash,
      });
    expect(res.status).toBe(201);
    expect(res.body.workerId).toBe(workerAId2);
  });

  it('rejects token=A with body.workerId=B → 403', async () => {
    const res = await request(app)
      .post('/api/v1/evidence')
      .set(authHeader(tokenA))
      .send({
        workerId: workerBId,   // mismatch — A trying to submit as B
        source: 'DECLARED',
        type: 'SELF_DECLARED',
        platform: 'ZOMATO',
        amount: 100,
        currency: 'INR',
        reference: 'REF-003',
        timestamp: new Date().toISOString(),
        capturedAt: new Date().toISOString(),
        previousHash: 'GENESIS_0000000000000000000000000000000000000000000000000000000000000000',
        integrityHash: 'a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8',
      });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('WORKER_ID_MISMATCH');
    expect(res.body.message).toMatch(new RegExp(workerBId));
  });

  it('rejects token=A accessing evidence URL for worker B → 403', async () => {
    const res = await request(app)
      .get(`/api/v1/evidence/worker/${workerBId}`)
      .set(authHeader(tokenA));
    expect(res.status).toBe(403);
    expect(['FORBIDDEN', 'WORKER_ID_MISMATCH']).toContain(res.body.error);
  });

  it('allows token=B accessing evidence URL for worker B', async () => {
    const res = await request(app)
      .get(`/api/v1/evidence/worker/${workerBId}`)
      .set(authHeader(tokenB));
    // 200 with empty array is acceptable (no evidence yet)
    expect([200]).toContain(res.status);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('rejects token=A issuing credential with body.workerId=B → 403', async () => {
    const res = await request(app)
      .post('/api/v1/credentials/issue')
      .set(authHeader(tokenA))
      .send({
        workerId: workerBId,   // mismatch
        disclosedClaims: {
          verifiedIncome: 30100,
          period: '01 Aug to 07 Aug 2026',
          verificationLevel: 'FINANCIALLY_CORROBORATED',
        },
      });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('WORKER_ID_MISMATCH');
  });

  it('rejects token=A running reconciliation for body.workerId=B → 403', async () => {
    const res = await request(app)
      .post('/api/v1/reconciliation/run')
      .set(authHeader(tokenA))
      .send({
        workerId: workerBId,
        payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
        evidenceIds: ['ev-test-001'],
      });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('WORKER_ID_MISMATCH');
  });

  it('rejects token=A triggering verification for body.workerId=B → 403', async () => {
    const res = await request(app)
      .post('/api/v1/verification/level')
      .set(authHeader(tokenA))
      .send({
        workerId: workerBId,
        payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
        evidenceIds: ['ev-test-001'],
      });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('WORKER_ID_MISMATCH');
  });

  it('rejects token=A requesting consent for body.workerId=B → 403', async () => {
    const res = await request(app)
      .post('/api/v1/consent/request')
      .set(authHeader(tokenA))
      .send({
        workerId: workerBId,
        aaProvider: 'Setu Mock AA',
      });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('WORKER_ID_MISMATCH');
  });
});

// ---------------------------------------------------------------------------
// 3. auth/login endpoint (dev/demo only)
// ---------------------------------------------------------------------------
describe('POST /api/v1/auth/login', () => {
  it('issues a JWT for valid workerId', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ workerId: 'OS-LOGIN-TEST-001', role: 'WORKER' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.workerId).toBe('OS-LOGIN-TEST-001');
    expect(res.body.role).toBe('WORKER');
    expect(res.body._warning).toMatch(/DEV\/DEMO ONLY/);

    // Verify the issued token is actually valid
    const decoded = jwt.verify(res.body.token, TEST_JWT_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload;
    expect(decoded.sub).toBe('OS-LOGIN-TEST-001');
    expect(decoded.role).toBe('WORKER');
  });

  it('defaults to WORKER role when role omitted', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ workerId: 'OS-LOGIN-TEST-002' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('WORKER');
  });

  it('returns 400 when workerId is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ role: 'WORKER' });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// 4. E2E auth flow — Worker A full journey, then cross-worker rejection
// ---------------------------------------------------------------------------
describe('E2E Auth: Worker A scoped journey + cross-worker rejection', () => {
  const e2eWorkerId = `OS-E2E-AUTH-${Date.now()}`;
  const crossWorkerId = `OS-E2E-CROSS-${Date.now()}`;
  let e2eToken: string;
  let crossToken: string;
  let issuedCredential: any;

  beforeAll(async () => {
    e2eToken = makeToken(e2eWorkerId);
    crossToken = makeToken(crossWorkerId);

    await IdentityVerification.create({
      workerId: e2eWorkerId,
      provider: 'SETU_DIGILOCKER',
      status: 'VERIFIED',
      verifiedAt: new Date(),
    });

    await IdentityVerification.create({
      workerId: crossWorkerId,
      provider: 'SETU_DIGILOCKER',
      status: 'VERIFIED',
      verifiedAt: new Date(),
    });
  });

  afterAll(async () => {
    await Worker.deleteMany({ id: { $in: [e2eWorkerId, crossWorkerId] } });
    await Evidence.deleteMany({ workerId: e2eWorkerId });
    await Credential.deleteMany({ workerId: e2eWorkerId });
  });

  it('Step 1: Worker A creates their profile', async () => {
    const res = await request(app)
      .post('/api/v1/workers')
      .set(authHeader(e2eToken))
      .send({ id: e2eWorkerId, name: 'Auth E2E Worker', workerCategory: 'Delivery Partner' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(e2eWorkerId);
  });

  it('Step 2: Worker A submits evidence (workerId derived from JWT, not body)', async () => {
    const id = `ev-auth-e2e-${Date.now()}`;
    const ts = '2026-08-07T12:00:00Z';
    const prev = 'GENESIS_0000000000000000000000000000000000000000000000000000000000000000';
    const hash = require('crypto').createHash('sha256').update(`${id}|${e2eWorkerId}|FINANCIAL|HDFC Bank|30100|${ts}|${prev}`).digest('hex');
    const res = await request(app)
      .post('/api/v1/evidence')
      .set(authHeader(e2eToken))
      .send({
        id,
        // NO workerId in body — should be derived from JWT
        source: 'FINANCIAL',
        type: 'AA_BANK_SETTLEMENT',
        platform: 'HDFC Bank',
        amount: 30100,
        currency: 'INR',
        reference: 'TXN-E2E-AUTH-001',
        timestamp: ts,
        capturedAt: new Date().toISOString(),
        previousHash: prev,
        integrityHash: hash,
      });
    expect(res.status).toBe(201);
    expect(res.body.workerId).toBe(e2eWorkerId); // must come from JWT
  });

  it('Step 3: Worker A retrieves their own evidence', async () => {
    const res = await request(app)
      .get(`/api/v1/evidence/worker/${e2eWorkerId}`)
      .set(authHeader(e2eToken));
    expect(res.status).toBe(200);
  });

  it('Step 4: Worker A runs reconciliation (workerId from JWT)', async () => {
    const res = await request(app)
      .post('/api/v1/reconciliation/run')
      .set(authHeader(e2eToken))
      .send({
        payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
        evidenceIds: ['ev-decl-001', 'ev-obs-zomato-001'],
      });
    expect(res.status).toBe(200);
    expect(res.body.status).toBeDefined();
  });

  it('Step 5+6: Worker A runs authoritative verification, then issues a credential', async () => {
    // Run /verification/run to persist a VerificationRecord and obtain verificationId
    const runRes = await request(app)
      .post('/api/v1/verification/run')
      .set(authHeader(e2eToken))
      .send({
        payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
        evidenceIds: ['ev-decl-001', 'ev-obs-zomato-001'],
      });
    expect(runRes.status).toBe(200);
    expect(runRes.body.id).toBeDefined();
    const verificationId = runRes.body.id;

    const res = await request(app)
      .post('/api/v1/credentials/issue')
      .set(authHeader(e2eToken))
      .send({
        verificationId,
      });
    expect(res.status).toBe(201);
    expect(res.body.credential).toBeDefined();
    expect(res.body.credential.workerId).toBe(e2eWorkerId); // from JWT
    issuedCredential = res.body.credential;
  });

  it('Step 7: Cross-worker rejection — token=A with body.workerId=crossWorker → 403', async () => {
    const res = await request(app)
      .post('/api/v1/credentials/issue')
      .set(authHeader(e2eToken))
      .send({
        workerId: crossWorkerId, // A trying to issue credential as crossWorker
        disclosedClaims: {
          verifiedIncome: 30100,
          period: '01 Aug to 07 Aug 2026',
          verificationLevel: 'FINANCIALLY_CORROBORATED',
        },
      });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('WORKER_ID_MISMATCH');
  });

  it('Step 8: token=cross with body.workerId=crossWorker → allowed (B can act as B)', async () => {
    // First obtain a verificationId for crossWorker
    const runRes = await request(app)
      .post('/api/v1/verification/run')
      .set(authHeader(crossToken))
      .send({
        payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
        evidenceIds: ['ev-decl-001'],
      });
    expect(runRes.status).toBe(200);
    const crossVerificationId = runRes.body.id;

    const res = await request(app)
      .post('/api/v1/credentials/issue')
      .set(authHeader(crossToken))
      .send({
        workerId: crossWorkerId, // B acting as B — should succeed
        verificationId: crossVerificationId,
      });
    expect(res.status).toBe(201);
    expect(res.body.credential.workerId).toBe(crossWorkerId);
  });

  it('Step 9: Issued credential verifies correctly (public endpoint)', async () => {
    if (!issuedCredential) {
      return; // Step 6 was skipped or failed
    }
    const res = await request(app)
      .post('/api/v1/credentials/verify')
      .send(issuedCredential);
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.signatureVerified).toBe(true);
  });
});




