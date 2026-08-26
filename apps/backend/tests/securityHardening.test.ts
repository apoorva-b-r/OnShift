import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import crypto from 'crypto';
import app from '../src/index';
import { generateWorkerToken } from '../src/middleware/authMiddleware';
import { Evidence, VerificationRecord, Credential, IdentityVerification, ConsentRequest } from '../src/models';
import { config } from '../src/config';

function createCustomJwt(headerObj: object, payloadObj: object, secret: string = config.jwtSecret): string {
  const encHeader = Buffer.from(JSON.stringify(headerObj)).toString('base64url');
  const encPayload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const data = `${encHeader}.${encPayload}`;
  if ((headerObj as any).alg === 'none') {
    return `${data}.`;
  }
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

describe('P0 Authentication & Authorization Hardening Test Suite', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    if (mongoose.connection.db) {
      await mongoose.connection.db.dropDatabase();
    }
  });

  // 1. Missing Authorization header -> 401
  it('1. Missing Authorization header returns 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/api/v1/evidence/worker/OS-WORKER-1');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  // 2. Malformed Authorization header -> 401
  it('2. Malformed Authorization header returns 401 INVALID_TOKEN', async () => {
    const res = await request(app)
      .get('/api/v1/evidence/worker/OS-WORKER-1')
      .set('Authorization', 'Bearer invalid-token-string-with-no-dots');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_TOKEN');
  });

  // 3. Invalid JWT signature -> 401
  it('3. Invalid JWT signature returns 401 INVALID_TOKEN', async () => {
    const token = createCustomJwt(
      { alg: 'HS256', typ: 'JWT' },
      { sub: 'OS-WORKER-1', role: 'WORKER', exp: Math.floor(Date.now() / 1000) + 3600 },
      'wrong-secret-key'
    );
    const res = await request(app)
      .get('/api/v1/evidence/worker/OS-WORKER-1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_TOKEN');
  });

  // 4. Expired JWT -> 401
  it('4. Expired JWT returns 401 EXPIRED_TOKEN', async () => {
    const token = generateWorkerToken('OS-WORKER-1', -1000); // expired 1s ago
    const res = await request(app)
      .get('/api/v1/evidence/worker/OS-WORKER-1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('EXPIRED_TOKEN');
  });

  // 5. Missing JWT sub -> 401
  it('5. Missing JWT sub claim returns 401 INVALID_TOKEN', async () => {
    const token = createCustomJwt(
      { alg: 'HS256', typ: 'JWT' },
      { role: 'WORKER', exp: Math.floor(Date.now() / 1000) + 3600 }
    );
    const res = await request(app)
      .get('/api/v1/evidence/worker/OS-WORKER-1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_TOKEN');
  });

  // 6. Token with valid sub but no role claim is normalised to WORKER → auth passes (200 or 403/404, not 401)
  it('6. Token with valid sub but missing role claim is normalised to WORKER (not rejected)', async () => {
    const token = createCustomJwt(
      { alg: 'HS256', typ: 'JWT' },
      { sub: 'OS-WORKER-1', exp: Math.floor(Date.now() / 1000) + 3600 }
    );
    const res = await request(app)
      .get('/api/v1/evidence/worker/OS-WORKER-1')
      .set('Authorization', `Bearer ${token}`);
    // Role is normalised to WORKER; auth passes (result may be 200 or 404/403 based on data state)
    expect(res.status).not.toBe(401);
  });

  // 7. alg: none JWT -> 401
  it('7. Unsigned alg:none JWT returns 401 INVALID_TOKEN', async () => {
    const token = createCustomJwt(
      { alg: 'none', typ: 'JWT' },
      { sub: 'OS-WORKER-1', role: 'WORKER', exp: Math.floor(Date.now() / 1000) + 3600 }
    );
    const res = await request(app)
      .get('/api/v1/evidence/worker/OS-WORKER-1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_TOKEN');
  });

  // 8. Unapproved JWT algorithm -> 401
  it('8. Unapproved algorithm (RS256) header returns 401 INVALID_TOKEN', async () => {
    const token = createCustomJwt(
      { alg: 'RS256', typ: 'JWT' },
      { sub: 'OS-WORKER-1', role: 'WORKER', exp: Math.floor(Date.now() / 1000) + 3600 }
    );
    const res = await request(app)
      .get('/api/v1/evidence/worker/OS-WORKER-1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_TOKEN');
  });

  // 9. Worker A token + Worker A body workerId -> allowed
  it('9. Worker A token + Worker A body workerId is allowed', async () => {
    const tokenA = generateWorkerToken('OS-WORKER-A');
    const res = await request(app)
      .post('/api/v1/reconciliation/run')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        workerId: 'OS-WORKER-A',
        payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
        evidenceIds: ['ev-decl-001'],
      });
    expect(res.status).toBe(200);
  });

  // 10. Worker A token + Worker B body workerId -> 403
  it('10. Worker A token + Worker B body workerId returns 403 WORKER_ID_MISMATCH', async () => {
    const tokenA = generateWorkerToken('OS-WORKER-A');
    const res = await request(app)
      .post('/api/v1/reconciliation/run')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        workerId: 'OS-WORKER-B',
        payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
        evidenceIds: ['ev-decl-001'],
      });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('WORKER_ID_MISMATCH');
  });

  // 11. Worker A token + Worker B URL workerId -> 403
  it('11. Worker A token + Worker B URL workerId returns 403 WORKER_ID_MISMATCH', async () => {
    const tokenA = generateWorkerToken('OS-WORKER-A');
    const res = await request(app)
      .get('/api/v1/evidence/worker/OS-WORKER-B')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('WORKER_ID_MISMATCH');
  });

  // 12. Worker A token + Worker B query workerId -> 403
  it('12. Worker A token + Worker B query workerId returns 403 WORKER_ID_MISMATCH', async () => {
    const tokenA = generateWorkerToken('OS-WORKER-A');
    const res = await request(app)
      .post('/api/v1/identity/digilocker/initiate?workerId=OS-WORKER-B')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('WORKER_ID_MISMATCH');
  });

  // 13. Omitted worker ID is derived from JWT where supported
  it('13. Omitted workerId in body is automatically derived from JWT sub', async () => {
    const tokenA = generateWorkerToken('OS-WORKER-DERIVED');
    const res = await request(app)
      .post('/api/v1/evidence')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        source: 'OBSERVED',
        type: 'ORDER_COMPLETED',
        platform: 'Zomato',
        amount: 500,
        currency: 'INR',
        reference: 'REF-DERIVED-001',
        timestamp: new Date().toISOString(),
        capturedAt: new Date().toISOString(),
        previousHash: 'GENESIS_0000000000000000000000000000000000000000000000000000000000000000',
        integrityHash: 'a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8',
      });
    expect(res.status).toBe(201);
    expect(res.body.workerId).toBe('OS-WORKER-DERIVED');
  });

  // 14. Worker A cannot retrieve Worker B evidence
  it('14. Worker A cannot retrieve Worker B evidence', async () => {
    await Evidence.create({
      id: 'ev-worker-b-priv',
      workerId: 'OS-WORKER-B',
      source: 'DECLARED',
      type: 'SELF_REPORTED_PAYOUT',
      platform: 'Swiggy',
      amount: 1000,
      currency: 'INR',
      reference: 'REF-B',
      timestamp: new Date().toISOString(),
      previousHash: 'GENESIS',
      integrityHash: 'HASH',
      capturedAt: new Date().toISOString(),
    });

    const tokenA = generateWorkerToken('OS-WORKER-A');
    const res = await request(app)
      .get('/api/v1/evidence/worker/OS-WORKER-B')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('WORKER_ID_MISMATCH');
  });

  // 15. Worker A cannot access Worker B data by guessing resource ID
  it('15. Worker A cannot access Worker B consent by guessing consentId', async () => {
    await ConsentRequest.create({
      consentId: 'AA-CONSENT-SECRET-B',
      workerId: 'OS-WORKER-B',
      fiTypes: ['DEPOSIT'],
      status: 'PENDING',
      consentUrl: 'https://aa.example.com',
      isMock: true,
    });

    const tokenA = generateWorkerToken('OS-WORKER-A');
    const res = await request(app)
      .get('/api/v1/consent/status/AA-CONSENT-SECRET-B')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN_CONSENT_ACCESS');
  });

  // 16. Worker A cannot reconcile, verify, submit evidence, sync, or issue credentials for Worker B
  it('16. Worker A cannot issue credential using Worker B verification record', async () => {
    const vrB = await VerificationRecord.create({
      id: 'vr-worker-b-001',
      workerId: 'OS-WORKER-B',
      payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
      level: 'FINANCIALLY_CORROBORATED',
      confidence: 0.95,
      reason: 'Matched',
      supportingEvidence: [],
      limitations: 'None',
      evidenceIds: [],
      computedAt: new Date().toISOString(),
    });

    await IdentityVerification.create({
      workerId: 'OS-WORKER-A',
      provider: 'SETU_DIGILOCKER',
      status: 'VERIFIED',
      verifiedAt: new Date(),
    });

    const tokenA = generateWorkerToken('OS-WORKER-A');
    const res = await request(app)
      .post('/api/v1/credentials/issue')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ verificationId: vrB.id });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN_WORKER_MISMATCH');
  });

  // 17. Evidence created using Worker A JWT persists with workerId=Worker A
  it('17. Evidence created with Worker A JWT persists with workerId=OS-WORKER-A', async () => {
    const tokenA = generateWorkerToken('OS-WORKER-A');
    const res = await request(app)
      .post('/api/v1/evidence')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        workerId: 'OS-WORKER-A',
        source: 'OBSERVED',
        type: 'ORDER_COMPLETED',
        platform: 'Zomato',
        amount: 300,
        currency: 'INR',
        reference: 'REF-A-PER',
        timestamp: new Date().toISOString(),
        capturedAt: new Date().toISOString(),
        previousHash: 'GENESIS',
        integrityHash: 'HASH-A-PER',
      });

    expect(res.status).toBe(201);
    const dbDoc = await Evidence.findOne({ reference: 'REF-A-PER' });
    expect(dbDoc).not.toBeNull();
    expect(dbDoc!.workerId).toBe('OS-WORKER-A');
  });

  // 18. Credentials persist with worker ID derived from JWT sub
  it('18. Credential persists with worker ID derived from JWT sub', async () => {
    const workerId = 'OS-WORKER-CRED-SUB';
    const token = generateWorkerToken(workerId);

    await IdentityVerification.create({
      workerId,
      provider: 'SETU_DIGILOCKER',
      status: 'VERIFIED',
      verifiedAt: new Date(),
    });

    const vr = await VerificationRecord.create({
      id: `vr-sub-${Date.now()}`,
      workerId,
      payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
      level: 'FINANCIALLY_CORROBORATED',
      confidence: 0.95,
      reason: 'Matched',
      supportingEvidence: [],
      limitations: 'None',
      evidenceIds: [],
      computedAt: new Date().toISOString(),
    });

    const res = await request(app)
      .post('/api/v1/credentials/issue')
      .set('Authorization', `Bearer ${token}`)
      .send({ verificationId: vr.id });

    expect(res.status).toBe(201);
    const credDoc = await Credential.findOne({ verificationId: vr.id });
    expect(credDoc).not.toBeNull();
    expect(credDoc!.workerId).toBe(workerId);
  });

  // 19. No API response, error response, or logging path exposes JWTs, Authorization headers, or secrets
  it('19. Error responses do not leak JWT tokens or secret keys', async () => {
    const secretKey = config.jwtSecret;
    const token = generateWorkerToken('OS-WORKER-LEAK-TEST');

    const res = await request(app)
      .post('/api/v1/reconciliation/run')
      .set('Authorization', `Bearer ${token}`)
      .send({
        workerId: 'OS-WORKER-LEAK-OTHER',
        payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
      });

    expect(res.status).toBe(403);
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain(token);
    expect(bodyStr).not.toContain(secretKey);
  });

  // 20. End-to-end authorization demonstration
  it('20. End-to-end authorization demonstration flow', async () => {
    const workerA = 'OS-DEMO-WORKER-A';
    const workerB = 'OS-DEMO-WORKER-B';
    const tokenA = generateWorkerToken(workerA);
    const tokenB = generateWorkerToken(workerB);

    // 1. Worker A submits evidence -> persists with workerId=workerA
    const evRes = await request(app)
      .post('/api/v1/evidence')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        source: 'FINANCIAL',
        type: 'AA_BANK_SETTLEMENT',
        platform: 'HDFC Bank',
        amount: 30100,
        currency: 'INR',
        reference: 'TXN-DEMO-A',
        timestamp: '2026-08-07T12:00:00Z',
        capturedAt: new Date().toISOString(),
        previousHash: 'GENESIS',
        integrityHash: 'HASH-DEMO-A',
      });
    expect(evRes.status).toBe(201);
    expect(evRes.body.workerId).toBe(workerA);

    // 2. Verification/reconciliation runs for Worker A
    const reconRes = await request(app)
      .post('/api/v1/reconciliation/run')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
        evidenceIds: [evRes.body.id],
      });
    expect(reconRes.status).toBe(200);

    const verRes = await request(app)
      .post('/api/v1/verification/run')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
        evidenceIds: [evRes.body.id],
      });
    expect(verRes.status).toBe(200);
    expect(verRes.body.workerId).toBe(workerA);

    // 3. Credential issued for Worker A (after verifying identity)
    await IdentityVerification.create({
      workerId: workerA,
      provider: 'SETU_DIGILOCKER',
      status: 'VERIFIED',
      verifiedAt: new Date(),
    });

    const credRes = await request(app)
      .post('/api/v1/credentials/issue')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ verificationId: verRes.body.id });
    expect(credRes.status).toBe(201);
    expect(credRes.body.credential.workerId).toBe(workerA);

    // 4. Worker A JWT + request workerId=workerB -> rejected with 403 WORKER_ID_MISMATCH
    const mismatchRes = await request(app)
      .post('/api/v1/verification/run')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        workerId: workerB,
        payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
      });
    expect(mismatchRes.status).toBe(403);
    expect(mismatchRes.body.error).toBe('WORKER_ID_MISMATCH');

    // 5. Worker B JWT + request workerId=workerB -> allowed
    const workerBRes = await request(app)
      .post('/api/v1/verification/run')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        workerId: workerB,
        payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
      });
    expect(workerBRes.status).toBe(200);
    expect(workerBRes.body.workerId).toBe(workerB);
  });
});
