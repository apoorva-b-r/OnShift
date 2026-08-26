/**
 * OnShift Demo Credential Generator
 * Generates valid sample and tampered credentials with Ed25519 signatures and validUntil field.
 */

const {
  signCredential,
} = require('../packages/credential-schema/dist/index.js');

const fs = require('fs');
const path = require('path');

async function generateDemoCredentials() {
  console.log('==================================================');
  console.log('ONSHIFT DEMO CREDENTIAL GENERATOR');
  console.log('==================================================\n');

  const privateKeyHex = process.env.ED25519_PRIVATE_KEY_HEX;
  const publicKeyHex = process.env.ED25519_PUBLIC_KEY_HEX;
  if (!privateKeyHex || !publicKeyHex) {
    throw new Error('Set ED25519_PRIVATE_KEY_HEX and ED25519_PUBLIC_KEY_HEX before generating credentials.');
  }
  console.log('[KeyPair] Using the configured OnShift Proof Authority key');
  console.log(`  Public Key:  ${publicKeyHex.slice(0, 32)}...\n`);

  // Generate canonical valid credential
  const validCredential = signCredential(
    'OS-DEMO-001',
    {
      verifiedIncome: 30100,
      period: '01 Aug to 07 Aug 2026',
      verificationLevel: 'FINANCIALLY_CORROBORATED',
    },
    privateKeyHex,
    publicKeyHex,
    'OnShift Proof Authority'
  );

  console.log('[Credential] Generated valid demo credential');
  console.log(`  Worker ID:       ${validCredential.workerId}`);
  console.log(`  Issued At:       ${validCredential.issuedAt}`);
  console.log(`  Valid Until:     ${validCredential.validUntil}`);
  console.log(`  Verified Income: ₹${validCredential.claims.verifiedIncome}`);
  console.log(`  Verification:    ${validCredential.claims.verificationLevel}`);
  console.log(`  Signature:       ${validCredential.signature.slice(0, 32)}...\n`);

  // Save valid credential
  const samplePath = path.join(__dirname, '../sample-credential.json');
  fs.writeFileSync(samplePath, JSON.stringify(validCredential, null, 2));
  console.log(`✓ Saved to: sample-credential.json\n`);

  // Generate tampered credential (modified income)
  const tamperedCredential = {
    ...validCredential,
    claims: {
      ...validCredential.claims,
      verifiedIncome: 50100, // Tampered value
    },
  };

  console.log('[Tampered] Generated tampered credential (income modified)');
  console.log(`  Original Income: ₹${validCredential.claims.verifiedIncome}`);
  console.log(`  Tampered Income: ₹${tamperedCredential.claims.verifiedIncome}`);
  console.log(`  Signature:       ${tamperedCredential.signature.slice(0, 32)}... (WILL FAIL VERIFICATION)\n`);

  // Save tampered credential
  const tamperedPath = path.join(__dirname, '../tampered-credential.json');
  fs.writeFileSync(tamperedPath, JSON.stringify(tamperedCredential, null, 2));
  console.log(`✓ Saved to: tampered-credential.json\n`);

  console.log('--------------------------------------------------');
  console.log('SUCCESS: Demo credentials generated with validUntil field.');
  console.log('');
  console.log('VERIFICATION NOTES:');
  console.log('  • sample-credential.json:   Valid signature, will pass verification');
  console.log('  • tampered-credential.json: Modified claims, will FAIL verification');
  console.log('  • Both include validUntil: 90 days after issuedAt');
  console.log('  • validUntil is cryptographically protected by Ed25519 signature');
}

generateDemoCredentials().catch((err) => {
  console.error('Credential generation failed:', err);
  process.exit(1);
});
