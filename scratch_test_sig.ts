import { signCredential, verifyCredentialSignature } from './packages/credential-schema/src/index.ts';

const privHex = process.env.ED25519_PRIVATE_KEY_HEX;
const pubHex = process.env.ED25519_PUBLIC_KEY_HEX;

if (!privHex || !pubHex) {
  throw new Error('Set ED25519_PRIVATE_KEY_HEX and ED25519_PUBLIC_KEY_HEX before running this scratch test.');
}

const cred = signCredential(
  'OS-DEMO-001',
  {
    verifiedIncome: 30100,
    period: '01 Aug to 07 Aug 2026',
    verificationLevel: 'FINANCIALLY_CORROBORATED',
  },
  privHex,
  pubHex,
  'OnShift Proof Authority'
);

console.log('Original Credential:', JSON.stringify(cred, null, 2));
console.log('Original Verification:', verifyCredentialSignature(cred, {
  issuer: 'OnShift Proof Authority',
  publicKeyHex: pubHex,
}));

// Tamper income
const tampered = JSON.parse(JSON.stringify(cred));
tampered.claims.verifiedIncome = 95000;
console.log('Tampered Verification:', verifyCredentialSignature(tampered, {
  issuer: 'OnShift Proof Authority',
  publicKeyHex: pubHex,
}));

// Fix back to original
const fixed = JSON.parse(JSON.stringify(tampered));
fixed.claims.verifiedIncome = 30100;
console.log('Fixed Back Verification:', verifyCredentialSignature(fixed, {
  issuer: 'OnShift Proof Authority',
  publicKeyHex: pubHex,
}));
