import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/index';
import { Credential, CredentialMessage, IdentityVerification, VerificationRecord } from '../src/models';
import { generateWorkerToken } from '../src/middleware/authMiddleware';
import { verifyCredentialSignature } from '@onshift/credential-schema';
import { generateAndSendCredentialMessage } from '../src/services/credentialMessageService';

describe('Real Credential Message Pipeline Integration Test Suite', () => {
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
    await CredentialMessage.deleteMany({});
  });

  it('1. Generates credential message with deployed Vercel verification URL and canonical credential.json attachment', async () => {
    const workerId = 'sadhana.r@somaiya.edu';
    const credentialId = 'MOCK-CRED-SADHANA-001';

    await IdentityVerification.create({
      workerId,
      provider: 'SETU_DIGILOCKER',
      status: 'VERIFIED',
      verifiedAt: new Date(),
    });

    const vr = await VerificationRecord.create({
      id: 'vr-sadhana-mtaorci3-tkeg',
      workerId,
      payoutPeriod: { startDate: '2026-08-01', endDate: '2026-08-07' },
      level: 'FINANCIALLY_CORROBORATED',
      confidence: 0.96,
      reason: 'Matched',
      supportingEvidence: [],
      limitations: 'None',
      evidenceIds: [],
      expectedNet: 30100,
      engineSource: 'PYTHON_VERIFICATION_ENGINE',
      verificationSource: 'AUTHORITATIVE_ENGINE',
      computedAt: new Date().toISOString(),
    });

    const token = generateWorkerToken(workerId);

    const res = await request(app)
      .post('/api/v1/credentials/issue')
      .set('Authorization', `Bearer ${token}`)
      .send({
        workerId,
        verificationId: vr.id,
      });

    expect(res.status).toBe(201);
    expect(res.body.credential).toBeDefined();
    expect(res.body.message).toBeDefined();

    const msg = res.body.message;
    expect(msg.workerId).toBe(workerId);
    expect(msg.verificationUrl).toContain('https://on-shift-verifier-web-22pj-lb8kaaio1-apscaps.vercel.app/?credentialId=');
    expect(msg.attachments).toHaveLength(1);

    const attachment = msg.attachments[0];
    expect(attachment.fileName).toBe('credential.json');
    expect(attachment.mimeType).toBe('application/json');

    const attachmentContent = attachment.content;
    expect(attachmentContent.workerId).toBe(workerId);
    expect(attachmentContent.signature).toBeDefined();
    expect(attachmentContent.publicKeyHex).toBeDefined();

    // Verify secret key security: No private keys or secrets present in attachment
    expect(attachmentContent.privateKey).toBeUndefined();
    expect(attachmentContent.privateKeyHex).toBeUndefined();
    expect(attachmentContent.secret).toBeUndefined();
  });

  it('2. Dynamically formats verification URL and attachment for ANY credential ID (e.g. ABC-123)', async () => {
    const credDoc = {
      credentialId: 'ABC-123',
      workerId: 'worker.test@example.com',
      credentialType: 'Delivery Partner Work Credential',
      issuer: 'Mock Credential Provider',
      status: 'ACTIVE',
      issuedAt: '2026-08-27T00:00:00.000Z',
      validUntil: '2026-11-25T00:00:00.000Z',
      claims: { verifiedIncome: 45000, period: 'Aug 2026' },
      signature: '1234567890abcdef',
      publicKeyHex: 'fedcba0987654321',
    };

    const message = await generateAndSendCredentialMessage(credDoc);

    expect(message.credentialId).toBe('ABC-123');
    expect(message.verificationUrl).toBe('https://on-shift-verifier-web-22pj-lb8kaaio1-apscaps.vercel.app/?credentialId=ABC-123');
    expect(message.attachments[0].fileName).toBe('credential.json');
    expect(message.attachments[0].content.credentialId).toBe('ABC-123');
    expect(message.attachments[0].content.workerId).toBe('worker.test@example.com');
  });

  it('3. Modifying attached JSON signature causes cryptographic verification to fail', async () => {
    const workerId = 'sadhana.r@somaiya.edu';
    const credentialId = 'MOCK-CRED-SADHANA-001';

    const mockCredDoc = {
      credentialId,
      workerId,
      credentialType: 'Delivery Partner Work Credential',
      issuer: 'Mock Credential Provider',
      status: 'ACTIVE',
      issuedAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 90 * 86400000).toISOString(),
      claims: { verifiedIncome: 30100 },
      signature: '1be8dbd6c949a8e43a82e486702ab2f8a53f669a22075f00aff6909b57b105acbfacc09e646cf01a17d27a79e76603f3b5ccfe618361f32957c265a32f51190a',
      publicKeyHex: 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a',
    };

    const msg = await generateAndSendCredentialMessage(mockCredDoc);
    const attachmentContent = msg.attachments[0].content;

    // Mutate signature in attachment
    const tamperedAttachment = {
      ...attachmentContent,
      signature: attachmentContent.signature.slice(0, -1) + (attachmentContent.signature.endsWith('a') ? '0' : 'a'),
    };

    const verifyResult = verifyCredentialSignature(tamperedAttachment, {
      issuer: mockCredDoc.issuer,
      publicKeyHex: mockCredDoc.publicKeyHex,
    });

    expect(verifyResult.valid).toBe(false);
  });
});
