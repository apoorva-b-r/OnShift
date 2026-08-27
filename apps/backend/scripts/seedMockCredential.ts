import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Credential } from '../src/models/Credential';
import { issueCredential } from '../src/services/credentialService';
import { signCredential } from '@onshift/credential-schema';
import { config } from '../src/config';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export async function seedMockCredential(): Promise<{ inserted: number; skipped: number; credentialId: string }> {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/onshift_db';

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
  }

  const credentialId = 'MOCK-CRED-SADHANA-001';
  const workerId = 'sadhana.r@somaiya.edu';

  console.log(`[MOCK_CREDENTIAL] Seeder execution started for worker=${workerId}, credentialId=${credentialId}`);

  const existing = await Credential.findOne({ credentialId }).lean();
  if (existing) {
    console.log(`[MOCK_CREDENTIAL] Credential ID ${credentialId} already exists in MongoDB.`);
    console.log(`inserted: 0, skipped: 1`);
    return { inserted: 0, skipped: 1, credentialId };
  }

  const claims = {
    verifiedIncome: 30100,
    period: '2026-08-01 to 2026-08-07',
    verificationLevel: 'FINANCIALLY_CORROBORATED' as const,
    identityVerified: true,
    platformBreakdown: {
      Zomato: 15400,
      Swiggy: 14700,
    },
  };

  const issuer = 'Mock Credential Provider';
  const signedCredential = signCredential(
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
    issuer: signedCredential.issuer,
    issuerPublicKey: signedCredential.publicKeyHex,
    publicKeyHex: signedCredential.publicKeyHex,
    workerId,
    verificationId: 'vr-sadhana-mtaorci3-tkeg',
    status: 'ACTIVE',
    issuedAt: signedCredential.issuedAt,
    validUntil: signedCredential.validUntil,
    claims: signedCredential.claims,
    signature: signedCredential.signature,
  });

  console.log(`[MOCK_CREDENTIAL] Credential document created successfully.`);
  console.log(`[MOCK_CREDENTIAL] Credential ID: ${credentialId}`);
  console.log(`inserted: 1, skipped: 0`);

  return { inserted: 1, skipped: 0, credentialId };
}

if (require.main === module) {
  seedMockCredential()
    .then(() => mongoose.disconnect())
    .catch((err) => {
      console.error('[MOCK_CREDENTIAL] Seeding failed:', err);
      process.exit(1);
    });
}
