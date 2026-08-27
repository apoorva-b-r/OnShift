import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/index';
import { Credential } from '../src/models/Credential';
import { signCredential } from '@onshift/credential-schema';
import { config } from '../src/config';

describe('Mock Credential End-to-End Verification Pipeline', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  }, 30000);

  beforeEach(async () => {
    await Credential.deleteMany({});
  });

  it('Test A: Valid Active Credential (MOCK-CRED-SADHANA-001) returns valid = true', async () => {
    const credentialId = 'MOCK-CRED-SADHANA-001';
    const workerId = 'sadhana.r@somaiya.edu';
    const issuer = 'Mock Credential Provider';

    const claims = {
      verifiedIncome: 30100,
      period: '2026-08-01 to 2026-08-07',
      verificationLevel: 'FINANCIALLY_CORROBORATED' as const,
      identityVerified: true,
      platformBreakdown: { Zomato: 15400, Swiggy: 14700 },
    };

    const signed = signCredential(
      workerId,
      claims,
      config.ed25519PrivateKeyHex,
      config.ed25519PublicKeyHex,
      issuer
    );

    await Credential.create({
      credentialId,
      type: 'OnShiftIncomeCredential',
      credentialType: 'Delivery Partner Work Credential',
      issuer: signed.issuer,
      issuerPublicKey: signed.publicKeyHex,
      publicKeyHex: signed.publicKeyHex,
      workerId,
      verificationId: 'vr-sadhana-mtaorci3-tkeg',
      status: 'ACTIVE',
      issuedAt: signed.issuedAt,
      validUntil: signed.validUntil,
      claims: signed.claims,
      signature: signed.signature,
    });

    const res = await request(app).get(`/api/v1/credentials/verify/${credentialId}`);

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.credentialId).toBe(credentialId);
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.workerId).toBe(workerId);
    expect(res.body.credentialType).toBe('Delivery Partner Work Credential');
    expect(res.body.issuer).toBe(issuer);
    expect(res.body.claims.verifiedIncome).toBe(30100);
    expect(res.body.message).toContain('authentic and verified');
  });

  it('Test B: Non-existent Credential (MOCK-CRED-DOES-NOT-EXIST) returns 404', async () => {
    const res = await request(app).get('/api/v1/credentials/verify/MOCK-CRED-DOES-NOT-EXIST');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('CREDENTIAL_NOT_FOUND');
    expect(res.body.message).toContain('was not found');
  });

  it('Test C: Tampered Credential Signature returns valid = false', async () => {
    const credentialId = 'MOCK-CRED-TAMPERED-001';
    const workerId = 'sadhana.r@somaiya.edu';
    const issuer = 'Mock Credential Provider';

    const claims = {
      verifiedIncome: 30100,
      period: '2026-08-01 to 2026-08-07',
      verificationLevel: 'FINANCIALLY_CORROBORATED' as const,
    };

    const signed = signCredential(
      workerId,
      claims,
      config.ed25519PrivateKeyHex,
      config.ed25519PublicKeyHex,
      issuer
    );

    // Mutate signature
    const tamperedSig = signed.signature.slice(0, -1) + (signed.signature.endsWith('a') ? '0' : 'a');

    await Credential.create({
      credentialId,
      type: 'OnShiftIncomeCredential',
      credentialType: 'Delivery Partner Work Credential',
      issuer: signed.issuer,
      issuerPublicKey: signed.publicKeyHex,
      publicKeyHex: signed.publicKeyHex,
      workerId,
      status: 'ACTIVE',
      issuedAt: signed.issuedAt,
      validUntil: signed.validUntil,
      claims: signed.claims,
      signature: tamperedSig,
    });

    const res = await request(app).get(`/api/v1/credentials/verify/${credentialId}`);

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.credentialId).toBe(credentialId);
    expect(res.body.status).toBe('INVALID_SIGNATURE');
  });

  it('Test D: Revoked Credential (status: REVOKED) returns valid = false', async () => {
    const credentialId = 'MOCK-CRED-REVOKED-001';
    const workerId = 'sadhana.r@somaiya.edu';
    const issuer = 'Mock Credential Provider';

    const claims = {
      verifiedIncome: 30100,
      period: '2026-08-01 to 2026-08-07',
      verificationLevel: 'FINANCIALLY_CORROBORATED' as const,
    };

    const signed = signCredential(
      workerId,
      claims,
      config.ed25519PrivateKeyHex,
      config.ed25519PublicKeyHex,
      issuer
    );

    await Credential.create({
      credentialId,
      type: 'OnShiftIncomeCredential',
      credentialType: 'Delivery Partner Work Credential',
      issuer: signed.issuer,
      issuerPublicKey: signed.publicKeyHex,
      publicKeyHex: signed.publicKeyHex,
      workerId,
      status: 'REVOKED',
      issuedAt: signed.issuedAt,
      validUntil: signed.validUntil,
      claims: signed.claims,
      signature: signed.signature,
    });

    const res = await request(app).get(`/api/v1/credentials/verify/${credentialId}`);

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.credentialId).toBe(credentialId);
    expect(res.body.status).toBe('REVOKED');
    expect(res.body.message).toContain('status is REVOKED');
  });
});
