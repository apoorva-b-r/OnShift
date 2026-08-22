import { signCredential, verifyCredentialSignature } from './packages/credential-schema/src/index.ts';

const privHex = '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60';
const pubHex = 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a';

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
console.log('Original Verification:', verifyCredentialSignature(cred));

// Tamper income
const tampered = JSON.parse(JSON.stringify(cred));
tampered.claims.verifiedIncome = 95000;
console.log('Tampered Verification:', verifyCredentialSignature(tampered));

// Fix back to original
const fixed = JSON.parse(JSON.stringify(tampered));
fixed.claims.verifiedIncome = 30100;
console.log('Fixed Back Verification:', verifyCredentialSignature(fixed));
