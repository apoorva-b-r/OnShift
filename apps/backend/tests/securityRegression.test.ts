import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/index';
import { generateWorkerToken } from '../src/middleware/authMiddleware';
import { validateCredentialIssue } from '../src/middleware/validateRequest';
import { calculateVerificationLevel } from '../src/services/verificationService';
import { runReconciliation } from '../src/services/reconciliationService';
import { VerificationRecord, IdentityVerification, Credential } from '../src/models';

describe('critical trust-boundary regressions', () => {
  let mongoServer: MongoMemoryServer;

  jest.setTimeout(30000);

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

  it('requires verificationId for credential issuance in request validation', () => {
    const details = validateCredentialIssue({ disclosedClaims: { verifiedIncome: 999999 } });
    expect(details).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'verificationId' }),
    ]));
  });

  it('returns 503 when the verification engine is unavailable', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockRejectedValue(new Error('engine offline')) as typeof fetch;

    await expect(calculateVerificationLevel(
      'OS-TEST',
      { startDate: '2026-08-01', endDate: '2026-08-07' },
      [],
    )).rejects.toMatchObject({
      statusCode: 503,
      code: 'VERIFICATION_SERVICE_UNAVAILABLE',
    });

    global.fetch = originalFetch;
  });

  it('returns 503 instead of a fixture when reconciliation is unavailable', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockRejectedValue(new Error('engine offline')) as typeof fetch;

    await expect(runReconciliation(
      'OS-TEST',
      { startDate: '2026-08-01', endDate: '2026-08-07' },
      [],
    )).rejects.toMatchObject({
      statusCode: 503,
      code: 'RECONCILIATION_SERVICE_UNAVAILABLE',
    });

    global.fetch = originalFetch;
  });

  // Task 3 Security Regression Suite for Credential Issuance
  describe('Credential Issuance Hardening', () => {
    const workerId = 'OS-WORKER-REGRESSION';
    let token: string;

    beforeEach(async () => {
      token = generateWorkerToken(workerId);
      await IdentityVerification.create({
        workerId,
        provider: 'SETU_DIGILOCKER',
        status: 'VERIFIED',
        verifiedAt: new Date(),
      });
    });

    it('missing verificationId -> 400 VERIFICATION_ID_REQUIRED', async () => {
      const res = await request(app)
        .post('/api/v1/credentials/issue')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(res.body.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'verificationId' })])
      );
    });

    it('client disclosedClaims cannot issue credentials without verificationId', async () => {
      const res = await request(app)
        .post('/api/v1/credentials/issue')
        .set('Authorization', `Bearer ${token}`)
        .send({
          disclosedClaims: {
            verifiedIncome: 999999,
            period: 'Fake Period',
            verificationLevel: 'FINANCIALLY_CORROBORATED',
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('unknown verificationId -> 404 VERIFICATION_NOT_FOUND', async () => {
      const res = await request(app)
        .post('/api/v1/credentials/issue')
        .set('Authorization', `Bearer ${token}`)
        .send({ verificationId: 'vr-non-existent-999' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('VERIFICATION_NOT_FOUND');
    });

    it('verificationId belonging to another worker -> 403 FORBIDDEN_WORKER_MISMATCH', async () => {
      const otherWorker = 'OS-WORKER-OTHER';
      const vrOther = await VerificationRecord.create({
        id: 'vr-other-123',
        workerId: otherWorker,
        payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
        level: 'FINANCIALLY_CORROBORATED',
        confidence: 0.95,
        reason: 'Matched',
        supportingEvidence: [],
        limitations: 'None',
        evidenceIds: [],
        engineSource: 'PYTHON_VERIFICATION_ENGINE',
        verificationSource: 'AUTHORITATIVE_ENGINE',
        computedAt: new Date().toISOString(),
      });

      const res = await request(app)
        .post('/api/v1/credentials/issue')
        .set('Authorization', `Bearer ${token}`)
        .send({ verificationId: vrOther.id });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN_WORKER_MISMATCH');
    });

    it('demo VerificationRecord -> 409 NON_AUTHORITATIVE_VERIFICATION', async () => {
      const vrDemo = await VerificationRecord.create({
        id: 'vr-demo-456',
        workerId,
        payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
        level: 'FINANCIALLY_CORROBORATED',
        confidence: 0.95,
        reason: 'Matched',
        supportingEvidence: [],
        limitations: 'None',
        evidenceIds: [],
        engineSource: 'MOCK_FALLBACK',
        verificationSource: 'DEMO_FIXTURE',
        computedAt: new Date().toISOString(),
      });

      const res = await request(app)
        .post('/api/v1/credentials/issue')
        .set('Authorization', `Bearer ${token}`)
        .send({ verificationId: vrDemo.id });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('NON_AUTHORITATIVE_VERIFICATION');
    });

    it('authoritative VerificationRecord -> 201 credential issued successfully', async () => {
      const vrAuth = await VerificationRecord.create({
        id: 'vr-auth-789',
        workerId,
        payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
        level: 'FINANCIALLY_CORROBORATED',
        confidence: 0.96,
        reason: 'Matched via engine',
        supportingEvidence: ['ev-1'],
        limitations: 'None',
        evidenceIds: ['ev-1'],
        expectedNet: 30100,
        engineSource: 'PYTHON_VERIFICATION_ENGINE',
        verificationSource: 'AUTHORITATIVE_ENGINE',
        computedAt: new Date().toISOString(),
      });

      const res = await request(app)
        .post('/api/v1/credentials/issue')
        .set('Authorization', `Bearer ${token}`)
        .send({ verificationId: vrAuth.id });

      expect(res.status).toBe(201);
      expect(res.body.credential).toBeDefined();
      expect(res.body.credential.workerId).toBe(workerId);
      expect(res.body.credential.claims.verifiedIncome).toBe(30100);
      expect(res.body.credential.claims.verificationLevel).toBe('FINANCIALLY_CORROBORATED');

      const savedInDb = await Credential.findOne({ verificationId: vrAuth.id });
      expect(savedInDb).not.toBeNull();
    });

    it('database outage during credential lookup -> 503 CREDENTIAL_DATABASE_UNAVAILABLE', async () => {
      const spy = jest.spyOn(VerificationRecord, 'findOne').mockImplementationOnce(() => {
        throw new Error('Database connection failed');
      });

      const res = await request(app)
        .post('/api/v1/credentials/issue')
        .set('Authorization', `Bearer ${token}`)
        .send({ verificationId: 'vr-any' });

      expect(res.status).toBe(503);
      expect(res.body.error).toBe('CREDENTIAL_DATABASE_UNAVAILABLE');

      spy.mockRestore();
    });
  });
});