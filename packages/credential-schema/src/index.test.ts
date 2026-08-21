import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateEd25519KeyPair,
  signCredential,
  verifyCredentialSignature,
  buildSelectiveDisclosureCredential,
  CredentialClaim,
  OnShiftIncomeCredential,
} from './index.js';

test('Test 1 — Key generation returns non-empty valid hex strings', () => {
  const keyPair = generateEd25519KeyPair();
  assert.ok(keyPair.publicKeyHex, 'publicKeyHex should exist');
  assert.ok(keyPair.privateKeyHex, 'privateKeyHex should exist');
  assert.match(keyPair.publicKeyHex, /^[0-9a-fA-F]+$/);
  assert.match(keyPair.privateKeyHex, /^[0-9a-fA-F]+$/);
});

test('Test 2 — Different key pairs generated are unique', () => {
  const kp1 = generateEd25519KeyPair();
  const kp2 = generateEd25519KeyPair();
  assert.notEqual(kp1.publicKeyHex, kp2.publicKeyHex);
  assert.notEqual(kp1.privateKeyHex, kp2.privateKeyHex);
});

test('Test 3 — Credential signing produces standard OnShiftIncomeCredential structure', () => {
  const keyPair = generateEd25519KeyPair();
  const workerId = 'OS-DEMO-001';
  const issuer = 'OnShift Demo Issuer';
  const claims: CredentialClaim = {
    verifiedIncome: 30100,
    period: '2026-07',
    verificationLevel: 'CORROBORATED',
  };

  const credential = signCredential(
    workerId,
    claims,
    keyPair.privateKeyHex,
    keyPair.publicKeyHex,
    issuer
  );

  assert.equal(credential.type, 'OnShiftIncomeCredential');
  assert.equal(credential.workerId, workerId);
  assert.equal(credential.issuer, issuer);
  assert.ok(credential.issuedAt, 'issuedAt should exist');
  assert.deepEqual(credential.claims, claims);
  assert.ok(credential.signature, 'signature should exist');
  assert.equal(credential.publicKeyHex, keyPair.publicKeyHex);
});

test('Test 4 — Signature exists and is a valid non-empty hex string', () => {
  const keyPair = generateEd25519KeyPair();
  const claims: CredentialClaim = {
    verifiedIncome: 30100,
    period: '2026-07',
    verificationLevel: 'CORROBORATED',
  };

  const credential = signCredential(
    'OS-DEMO-001',
    claims,
    keyPair.privateKeyHex,
    keyPair.publicKeyHex,
    'OnShift Demo Issuer'
  );

  assert.ok(credential.signature.length > 0);
  assert.match(credential.signature, /^[0-9a-fA-F]+$/);
});

test('Test 5 — Different payloads produce different signatures', () => {
  const keyPair = generateEd25519KeyPair();
  const claims1: CredentialClaim = {
    verifiedIncome: 30100,
    period: '2026-07',
    verificationLevel: 'CORROBORATED',
  };
  const claims2: CredentialClaim = {
    verifiedIncome: 45000,
    period: '2026-07',
    verificationLevel: 'CORROBORATED',
  };

  const cred1 = signCredential(
    'OS-DEMO-001',
    claims1,
    keyPair.privateKeyHex,
    keyPair.publicKeyHex,
    'OnShift Demo Issuer'
  );

  const cred2 = signCredential(
    'OS-DEMO-001',
    claims2,
    keyPair.privateKeyHex,
    keyPair.publicKeyHex,
    'OnShift Demo Issuer'
  );

  assert.notEqual(cred1.signature, cred2.signature);
});

test('Test 6 — Valid Roundtrip: KeyGen -> Sign -> Verify', () => {
  const keyPair = generateEd25519KeyPair();
  const workerId = 'OS-DEMO-001';
  const issuer = 'OnShift Demo Issuer';
  const claims: CredentialClaim = {
    verifiedIncome: 30100,
    period: '2026-07',
    verificationLevel: 'CORROBORATED',
  };

  const credential = signCredential(
    workerId,
    claims,
    keyPair.privateKeyHex,
    keyPair.publicKeyHex,
    issuer
  );

  const result = verifyCredentialSignature(credential);
  assert.equal(result.valid, true);
  assert.equal(result.signatureVerified, true);
  assert.equal(result.workerId, workerId);
  assert.equal(result.issuer, issuer);
  assert.deepEqual(result.claims, claims);
});

test('Test 7 — Required Tampering Test: Income modified', () => {
  const keyPair = generateEd25519KeyPair();
  const claims: CredentialClaim = {
    verifiedIncome: 30100,
    period: '2026-07',
    verificationLevel: 'CORROBORATED',
  };

  const credential = signCredential(
    'OS-DEMO-001',
    claims,
    keyPair.privateKeyHex,
    keyPair.publicKeyHex,
    'OnShift Demo Issuer'
  );

  assert.equal(verifyCredentialSignature(credential).valid, true);

  const tamperedCred: OnShiftIncomeCredential = {
    ...credential,
    claims: {
      ...credential.claims,
      verifiedIncome: 50100,
    },
  };

  const result = verifyCredentialSignature(tamperedCred);
  assert.equal(result.valid, false);
  assert.equal(result.signatureVerified, false);
});

test('Test 8 — Required Tampering Test: Worker ID modified', () => {
  const keyPair = generateEd25519KeyPair();
  const credential = signCredential(
    'OS-DEMO-001',
    { verifiedIncome: 30100, period: '2026-07', verificationLevel: 'CORROBORATED' },
    keyPair.privateKeyHex,
    keyPair.publicKeyHex,
    'OnShift Demo Issuer'
  );

  const tamperedCred: OnShiftIncomeCredential = {
    ...credential,
    workerId: 'OS-DEMO-999',
  };

  const result = verifyCredentialSignature(tamperedCred);
  assert.equal(result.valid, false);
  assert.equal(result.signatureVerified, false);
});

test('Test 9 — Required Tampering Test: Issuer modified', () => {
  const keyPair = generateEd25519KeyPair();
  const credential = signCredential(
    'OS-DEMO-001',
    { verifiedIncome: 30100, period: '2026-07', verificationLevel: 'CORROBORATED' },
    keyPair.privateKeyHex,
    keyPair.publicKeyHex,
    'OnShift Demo Issuer'
  );

  const tamperedCred: OnShiftIncomeCredential = {
    ...credential,
    issuer: 'Untrusted Rogue Issuer',
  };

  const result = verifyCredentialSignature(tamperedCred);
  assert.equal(result.valid, false);
  assert.equal(result.signatureVerified, false);
});

test('Test 10 — Required Tampering Test: Period modified', () => {
  const keyPair = generateEd25519KeyPair();
  const credential = signCredential(
    'OS-DEMO-001',
    { verifiedIncome: 30100, period: '2026-07', verificationLevel: 'CORROBORATED' },
    keyPair.privateKeyHex,
    keyPair.publicKeyHex,
    'OnShift Demo Issuer'
  );

  const tamperedCred: OnShiftIncomeCredential = {
    ...credential,
    claims: {
      ...credential.claims,
      period: '2026-08',
    },
  };

  const result = verifyCredentialSignature(tamperedCred);
  assert.equal(result.valid, false);
  assert.equal(result.signatureVerified, false);
});

test('Test 11 — Required Tampering Test: Verification Level modified', () => {
  const keyPair = generateEd25519KeyPair();
  const credential = signCredential(
    'OS-DEMO-001',
    { verifiedIncome: 30100, period: '2026-07', verificationLevel: 'CORROBORATED' },
    keyPair.privateKeyHex,
    keyPair.publicKeyHex,
    'OnShift Demo Issuer'
  );

  const tamperedCred: OnShiftIncomeCredential = {
    ...credential,
    claims: {
      ...credential.claims,
      verificationLevel: 'DECLARED',
    },
  };

  const result = verifyCredentialSignature(tamperedCred);
  assert.equal(result.valid, false);
  assert.equal(result.signatureVerified, false);
});

test('Test 12 — Required Tampering Test: Signature modified', () => {
  const keyPair = generateEd25519KeyPair();
  const credential = signCredential(
    'OS-DEMO-001',
    { verifiedIncome: 30100, period: '2026-07', verificationLevel: 'CORROBORATED' },
    keyPair.privateKeyHex,
    keyPair.publicKeyHex,
    'OnShift Demo Issuer'
  );

  const origSig = credential.signature;
  const lastChar = origSig.slice(-1);
  const replacementChar = lastChar === '0' ? '1' : '0';
  const modifiedSignature = origSig.slice(0, -1) + replacementChar;

  const tamperedCred: OnShiftIncomeCredential = {
    ...credential,
    signature: modifiedSignature,
  };

  const result = verifyCredentialSignature(tamperedCred);
  assert.equal(result.valid, false);
  assert.equal(result.signatureVerified, false);
});

test('Test 13 — Required Test: Public key replaced with unrelated key', () => {
  const keyPair1 = generateEd25519KeyPair();
  const keyPair2 = generateEd25519KeyPair();

  const credential = signCredential(
    'OS-DEMO-001',
    { verifiedIncome: 30100, period: '2026-07', verificationLevel: 'CORROBORATED' },
    keyPair1.privateKeyHex,
    keyPair1.publicKeyHex,
    'OnShift Demo Issuer'
  );

  const tamperedCred: OnShiftIncomeCredential = {
    ...credential,
    publicKeyHex: keyPair2.publicKeyHex,
  };

  const result = verifyCredentialSignature(tamperedCred);
  assert.equal(result.valid, false);
  assert.equal(result.signatureVerified, false);
});

test('Test 14 — Required Test: Malformed empty signature does not crash', () => {
  const keyPair = generateEd25519KeyPair();
  const credential = signCredential(
    'OS-DEMO-001',
    { verifiedIncome: 30100, period: '2026-07', verificationLevel: 'CORROBORATED' },
    keyPair.privateKeyHex,
    keyPair.publicKeyHex,
    'OnShift Demo Issuer'
  );

  const malformedCred: OnShiftIncomeCredential = {
    ...credential,
    signature: '',
  };

  const result = verifyCredentialSignature(malformedCred);
  assert.equal(result.valid, false);
  assert.equal(result.signatureVerified, false);
});

test('Test 15 — Required Test: Malformed public key fails safely', () => {
  const keyPair = generateEd25519KeyPair();
  const credential = signCredential(
    'OS-DEMO-001',
    { verifiedIncome: 30100, period: '2026-07', verificationLevel: 'CORROBORATED' },
    keyPair.privateKeyHex,
    keyPair.publicKeyHex,
    'OnShift Demo Issuer'
  );

  const malformedCred: OnShiftIncomeCredential = {
    ...credential,
    publicKeyHex: '1234invalidhexkey',
  };

  const result = verifyCredentialSignature(malformedCred);
  assert.equal(result.valid, false);
  assert.equal(result.signatureVerified, false);
});

// ==================================================
// PART 4: SELECTIVE DISCLOSURE TESTS
// ==================================================

test('Test 16 — Selective Disclosure: Only Income', () => {
  const keyPair = generateEd25519KeyPair();
  const fullClaims: CredentialClaim = {
    verifiedIncome: 30100,
    period: '2026-07',
    verificationLevel: 'CORROBORATED',
  };

  const cred = buildSelectiveDisclosureCredential(
    'OS-DEMO-001',
    fullClaims,
    { includeVerifiedIncome: true, includePeriod: false, includeVerificationLevel: false },
    keyPair.privateKeyHex,
    keyPair.publicKeyHex,
    'OnShift Demo Issuer'
  );

  assert.deepEqual(cred.claims, { verifiedIncome: 30100 });
  const result = verifyCredentialSignature(cred);
  assert.equal(result.valid, true);
  assert.equal(result.signatureVerified, true);
});

test('Test 17 — Selective Disclosure: Income + Period', () => {
  const keyPair = generateEd25519KeyPair();
  const fullClaims: CredentialClaim = {
    verifiedIncome: 30100,
    period: '2026-07',
    verificationLevel: 'CORROBORATED',
  };

  const cred = buildSelectiveDisclosureCredential(
    'OS-DEMO-001',
    fullClaims,
    { includeVerifiedIncome: true, includePeriod: true, includeVerificationLevel: false },
    keyPair.privateKeyHex,
    keyPair.publicKeyHex,
    'OnShift Demo Issuer'
  );

  assert.deepEqual(cred.claims, { verifiedIncome: 30100, period: '2026-07' });
  assert.equal((cred.claims as Record<string, any>).verificationLevel, undefined);
  const result = verifyCredentialSignature(cred);
  assert.equal(result.valid, true);
  assert.equal(result.signatureVerified, true);
});

test('Test 18 — Selective Disclosure: All Claims', () => {
  const keyPair = generateEd25519KeyPair();
  const fullClaims: CredentialClaim = {
    verifiedIncome: 30100,
    period: '2026-07',
    verificationLevel: 'CORROBORATED',
  };

  const cred = buildSelectiveDisclosureCredential(
    'OS-DEMO-001',
    fullClaims,
    { includeVerifiedIncome: true, includePeriod: true, includeVerificationLevel: true },
    keyPair.privateKeyHex,
    keyPair.publicKeyHex,
    'OnShift Demo Issuer'
  );

  assert.deepEqual(cred.claims, fullClaims);
  const result = verifyCredentialSignature(cred);
  assert.equal(result.valid, true);
  assert.equal(result.signatureVerified, true);
});

test('Test 19 — Selective Disclosure: No Claims', () => {
  const keyPair = generateEd25519KeyPair();
  const fullClaims: CredentialClaim = {
    verifiedIncome: 30100,
    period: '2026-07',
    verificationLevel: 'CORROBORATED',
  };

  const cred = buildSelectiveDisclosureCredential(
    'OS-DEMO-001',
    fullClaims,
    { includeVerifiedIncome: false, includePeriod: false, includeVerificationLevel: false },
    keyPair.privateKeyHex,
    keyPair.publicKeyHex,
    'OnShift Demo Issuer'
  );

  assert.deepEqual(cred.claims, {});
  const result = verifyCredentialSignature(cred);
  assert.equal(result.valid, true);
  assert.equal(result.signatureVerified, true);
});

test('Test 20 — Undisclosed claims cannot leak', () => {
  const keyPair = generateEd25519KeyPair();
  const fullClaims: CredentialClaim = {
    verifiedIncome: 30100,
    period: '2026-07',
    verificationLevel: 'CORROBORATED',
  };

  const cred = buildSelectiveDisclosureCredential(
    'OS-DEMO-001',
    fullClaims,
    { includeVerifiedIncome: true, includePeriod: false, includeVerificationLevel: false },
    keyPair.privateKeyHex,
    keyPair.publicKeyHex,
    'OnShift Demo Issuer'
  );

  assert.equal((cred.claims as Record<string, any>).period, undefined);
  assert.equal((cred.claims as Record<string, any>).verificationLevel, undefined);

  const jsonString = JSON.stringify(cred);
  assert.equal(jsonString.includes('2026-07'), false);
  assert.equal(jsonString.includes('CORROBORATED'), false);
});

test('Test 21 — Selective credential roundtrip for all configurations', () => {
  const keyPair = generateEd25519KeyPair();
  const fullClaims: CredentialClaim = {
    verifiedIncome: 30100,
    period: '2026-07',
    verificationLevel: 'CORROBORATED',
  };

  const configs = [
    { includeVerifiedIncome: true, includePeriod: false, includeVerificationLevel: false },
    { includeVerifiedIncome: false, includePeriod: true, includeVerificationLevel: false },
    { includeVerifiedIncome: false, includePeriod: false, includeVerificationLevel: true },
    { includeVerifiedIncome: true, includePeriod: true, includeVerificationLevel: false },
    { includeVerifiedIncome: true, includePeriod: false, includeVerificationLevel: true },
    { includeVerifiedIncome: false, includePeriod: true, includeVerificationLevel: true },
    { includeVerifiedIncome: true, includePeriod: true, includeVerificationLevel: true },
  ];

  for (const config of configs) {
    const cred = buildSelectiveDisclosureCredential(
      'OS-DEMO-001',
      fullClaims,
      config,
      keyPair.privateKeyHex,
      keyPair.publicKeyHex,
      'OnShift Demo Issuer'
    );
    const result = verifyCredentialSignature(cred);
    assert.equal(result.valid, true, `Config ${JSON.stringify(config)} should be valid`);
    assert.equal(result.signatureVerified, true);
  }
});

test('Test 22 — Tampering selective credential fails verification', () => {
  const keyPair = generateEd25519KeyPair();
  const fullClaims: CredentialClaim = {
    verifiedIncome: 30100,
    period: '2026-07',
    verificationLevel: 'CORROBORATED',
  };

  const cred = buildSelectiveDisclosureCredential(
    'OS-DEMO-001',
    fullClaims,
    { includeVerifiedIncome: true, includePeriod: false, includeVerificationLevel: false },
    keyPair.privateKeyHex,
    keyPair.publicKeyHex,
    'OnShift Demo Issuer'
  );

  assert.equal(verifyCredentialSignature(cred).valid, true);

  const tamperedCred: OnShiftIncomeCredential = {
    ...cred,
    claims: {
      verifiedIncome: 50100,
    },
  };

  const result = verifyCredentialSignature(tamperedCred);
  assert.equal(result.valid, false);
  assert.equal(result.signatureVerified, false);
});

// ==================================================
// PART 5: FINAL CREDENTIAL VALIDATION & DEMO TESTS
// ==================================================

test('Test 23 — Part 5: Full Credential Roundtrip with Selective Disclosure Builder (Ravi Kumar / OS-DEMO-001)', () => {
  const keyPair = generateEd25519KeyPair();
  const workerId = 'OS-DEMO-001';
  const issuer = 'OnShift Demo Issuer';
  const fullClaims: CredentialClaim = {
    verifiedIncome: 30100,
    period: '2026-07',
    verificationLevel: 'CORROBORATED',
  };

  const credential = buildSelectiveDisclosureCredential(
    workerId,
    fullClaims,
    { includeVerifiedIncome: true, includePeriod: true, includeVerificationLevel: true },
    keyPair.privateKeyHex,
    keyPair.publicKeyHex,
    issuer
  );

  const result = verifyCredentialSignature(credential);
  assert.equal(result.valid, true);
  assert.equal(result.signatureVerified, true);
  assert.equal(result.workerId, workerId);
  assert.equal(result.issuer, issuer);
  assert.deepEqual(result.claims, fullClaims);
});

test('Test 24 — Part 5: Independent Field Tampering (issuedAt)', () => {
  const keyPair = generateEd25519KeyPair();
  const credential = signCredential(
    'OS-DEMO-001',
    { verifiedIncome: 30100, period: '2026-07', verificationLevel: 'CORROBORATED' },
    keyPair.privateKeyHex,
    keyPair.publicKeyHex,
    'OnShift Demo Issuer'
  );

  assert.equal(verifyCredentialSignature(credential).valid, true);

  const tamperedCred: OnShiftIncomeCredential = {
    ...credential,
    issuedAt: '2020-01-01T00:00:00.000Z',
  };

  const result = verifyCredentialSignature(tamperedCred);
  assert.equal(result.valid, false);
  assert.equal(result.signatureVerified, false);
});

test('Test 25 — Part 5: Canonical Demo Credential Verification & Tamper Detection (30100 -> 50100)', () => {
  const keyPair = generateEd25519KeyPair();
  const demoCredential = signCredential(
    'OS-DEMO-001',
    { verifiedIncome: 30100, period: '2026-07', verificationLevel: 'CORROBORATED' },
    keyPair.privateKeyHex,
    keyPair.publicKeyHex,
    'OnShift Demo Issuer'
  );

  const originalResult = verifyCredentialSignature(demoCredential);
  assert.equal(originalResult.valid, true);
  assert.equal(originalResult.signatureVerified, true);

  const tamperedDemoCredential: OnShiftIncomeCredential = {
    ...demoCredential,
    claims: {
      ...demoCredential.claims,
      verifiedIncome: 50100,
    },
  };

  const tamperedResult = verifyCredentialSignature(tamperedDemoCredential);
  assert.equal(tamperedResult.valid, false);
  assert.equal(tamperedResult.signatureVerified, false);
});

test('Test 26 — Part 5: Public API Export Verification', async () => {
  const mod = await import('./index.js');
  assert.equal(typeof mod.generateEd25519KeyPair, 'function');
  assert.equal(typeof mod.signCredential, 'function');
  assert.equal(typeof mod.verifyCredentialSignature, 'function');
  assert.equal(typeof mod.buildSelectiveDisclosureCredential, 'function');
  assert.equal(typeof mod.serializeCredentialPayload, 'function');
});

