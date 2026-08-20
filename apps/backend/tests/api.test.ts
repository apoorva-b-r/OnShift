import app from '../src/index';
import { issueCredential, verifyCredential } from '../src/services/credentialService';

describe('OnShift Backend API Scaffold Tests', () => {
  test('Credential signing and verification roundtrip', () => {
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
