import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/index';
import { generateWorkerToken } from '../src/middleware/authMiddleware';
import { VerificationRecord, IdentityVerification, Credential } from '../src/models';

describe('credential persistence error handling', () => {
  let mongoServer: MongoMemoryServer;
  let workerId: string;
  let token: string;

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
    workerId = 'OS-PERSISTENCE-TEST';
    await IdentityVerification.create({
      workerId,
      provider: 'SETU_DIGILOCKER',
      status: 'VERIFIED',
      verifiedAt: new Date(),
    });
    token = generateWorkerToken(workerId);
  });

  afterEach(async () => {
    await VerificationRecord.deleteMany({});
    await Credential.deleteMany({});
    await IdentityVerification.deleteMany({});
  });

  it('normal credential issuance creates exactly one document in credentials collection', async () => {
    const verificationId = 'vr-normal-issuance';
    
    await VerificationRecord.create({
      id: verificationId,
      workerId,
      level: 'FINANCIALLY_CORROBORATED',
      confidence: 0.96,
      expectedNet: 30100,
      actualSettlement: 30100,
      reconciliationStatus: 'MATCHED',
      verificationSource: 'AUTHORITATIVE_ENGINE',
      payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
      reason: 'Expected payout matches actual bank settlement credit',
      supportingEvidence: [],
      limitations: 'None',
      computedAt: new Date(),
    });

    const res = await request(app)
      .post('/api/v1/credentials/issue')
      .set('Authorization', `Bearer ${token}`)
      .send({ verificationId });

    expect(res.status).toBe(201);
    expect(res.body.credential).toBeDefined();
    expect(res.body.credential.workerId).toBe(workerId);

    // Verify exactly one credential document exists
    const credentials = await Credential.find({ verificationId, workerId });
    expect(credentials.length).toBe(1);
    expect(credentials[0].workerId).toBe(workerId);
    expect(credentials[0].verificationId).toBe(verificationId);
  });

  it('MongoDB persistence failure during credential creation returns 503 CREDENTIAL_PERSISTENCE_FAILED', async () => {
    const verificationId = 'vr-persistence-failure';
    
    await VerificationRecord.create({
      id: verificationId,
      workerId,
      level: 'FINANCIALLY_CORROBORATED',
      confidence: 0.96,
      expectedNet: 30100,
      actualSettlement: 30100,
      reconciliationStatus: 'MATCHED',
      verificationSource: 'AUTHORITATIVE_ENGINE',
      payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
      reason: 'Expected payout matches actual bank settlement credit',
      supportingEvidence: [],
      limitations: 'None',
      computedAt: new Date(),
    });

    // Mock Credential.create to simulate MongoDB write failure
    const spy = jest.spyOn(Credential, 'create').mockRejectedValueOnce(
      new Error('MongoDB write failed: connection timeout')
    );

    const res = await request(app)
      .post('/api/v1/credentials/issue')
      .set('Authorization', `Bearer ${token}`)
      .send({ verificationId });

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('CREDENTIAL_PERSISTENCE_FAILED');
    expect(res.body.message).toContain('persist to database');
    expect(res.body.message).toContain('retry');

    // Verify no credential was created despite the signing operation
    const credentials = await Credential.find({ verificationId, workerId });
    expect(credentials.length).toBe(0);

    spy.mockRestore();
  });

  it('successful issuance does not swallow database errors', async () => {
    const verificationId = 'vr-success-case';
    
    await VerificationRecord.create({
      id: verificationId,
      workerId,
      level: 'FINANCIALLY_CORROBORATED',
      confidence: 0.96,
      expectedNet: 30100,
      actualSettlement: 30100,
      reconciliationStatus: 'MATCHED',
      verificationSource: 'AUTHORITATIVE_ENGINE',
      payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
      reason: 'Expected payout matches actual bank settlement credit',
      supportingEvidence: [],
      limitations: 'None',
      computedAt: new Date(),
    });

    // Mock a transient database error
    const spy = jest.spyOn(Credential, 'create').mockRejectedValueOnce(
      new Error('Transient MongoDB error')
    );

    const res = await request(app)
      .post('/api/v1/credentials/issue')
      .set('Authorization', `Bearer ${token}`)
      .send({ verificationId });

    // Should fail
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('CREDENTIAL_PERSISTENCE_FAILED');

    spy.mockRestore();
  });
});