import mongoose from 'mongoose';
import { config } from '../src/config';
import {
  Worker,
  IdentityVerification,
  Evidence,
  VerificationRecord,
  ConsentRequest,
  Credential,
} from '../src/models';
import { signCredential, verifyCredentialSignature } from '@onshift/credential-schema';

interface CloneOptions {
  sourceEmail: string;
  destinationEmail: string;
  dryRun: boolean;
  apply: boolean;
}

function parseArgs(): CloneOptions {
  const args = process.argv.slice(2);
  let sourceEmail = 'vikram.malhotra@example.com';
  let destinationEmail = 'sadhana.r@somaiya.edu';
  let dryRun = false;
  let apply = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--source-email' && args[i + 1]) {
      sourceEmail = args[i + 1];
      i++;
    } else if (args[i] === '--destination-email' && args[i + 1]) {
      destinationEmail = args[i + 1];
      i++;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--apply') {
      apply = true;
    }
  }

  if (!apply) {
    dryRun = true;
  }

  return { sourceEmail, destinationEmail, dryRun, apply };
}

export async function runCloning() {
  const options = parseArgs();
  console.log('\n================================================================');
  console.log('=== WORKER DATASET CLONING MIGRATION SCRIPT ===');
  console.log('================================================================');
  console.log(`MODE:               ${options.apply ? '⚡ APPLY (DATABASE WRITES ENABLED)' : '🔍 DRY-RUN (SIMULATION ONLY)'}`);
  console.log(`SOURCE EMAIL:       ${options.sourceEmail}`);
  console.log(`DESTINATION EMAIL:  ${options.destinationEmail}`);
  console.log('================================================================\n');

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(config.mongodbUri);
  }

  // 1. Resolve Source Worker
  const sourceWorkers = await Worker.find({
    $or: [{ email: options.sourceEmail }, { id: 'OS-FULL-PROFILE-TEST-001' }, { id: 'OS-DEMO-001' }],
  }).lean();

  if (sourceWorkers.length === 0) {
    throw new Error(`Source worker not found for email ${options.sourceEmail}`);
  }

  const primarySourceWorker =
    sourceWorkers.find((w) => w.email === options.sourceEmail) ||
    sourceWorkers.find((w) => w.id === 'OS-FULL-PROFILE-TEST-001') ||
    sourceWorkers[0];

  const sourceWorkerId = primarySourceWorker.id;

  // 2. Resolve Destination Worker
  let destWorker = await Worker.findOne({
    $or: [{ email: options.destinationEmail }, { id: 'OS-573771' }],
  }).lean();

  const destWorkerId = destWorker ? destWorker.id : 'OS-573771';

  console.log('=== WORKER IDENTIFIERS RESOLVED ===');
  console.log(`SOURCE:      email=${primarySourceWorker.email || options.sourceEmail}, workerId=${sourceWorkerId}`);
  console.log(`DESTINATION: email=${options.destinationEmail}, workerId=${destWorkerId}`);
  console.log('================================================================\n');

  // Audit Before Migration
  const beforeCounts = {
    workers: await Worker.countDocuments({ id: destWorkerId }),
    identityverifications: await IdentityVerification.countDocuments({ workerId: destWorkerId }),
    evidence: await Evidence.countDocuments({ workerId: destWorkerId }),
    verificationrecords: await VerificationRecord.countDocuments({ workerId: destWorkerId }),
    consentrequests: await ConsentRequest.countDocuments({ workerId: destWorkerId }),
    credentials: await Credential.countDocuments({ workerId: destWorkerId }),
  };

  const sourceCounts = {
    workers: await Worker.countDocuments({ $or: [{ id: sourceWorkerId }, { id: 'OS-DEMO-001' }] }),
    identityverifications: await IdentityVerification.countDocuments({ $or: [{ workerId: sourceWorkerId }, { workerId: 'OS-DEMO-001' }] }),
    evidence: await Evidence.countDocuments({ $or: [{ workerId: sourceWorkerId }, { workerId: 'OS-DEMO-001' }, { workerId: 'ev-decl-001' }] }),
    verificationrecords: await VerificationRecord.countDocuments({ $or: [{ workerId: sourceWorkerId }, { workerId: 'OS-DEMO-001' }] }),
    consentrequests: await ConsentRequest.countDocuments({ $or: [{ workerId: sourceWorkerId }, { workerId: 'OS-DEMO-001' }] }),
    credentials: await Credential.countDocuments({ $or: [{ workerId: sourceWorkerId }, { workerId: 'OS-DEMO-001' }] }),
  };

  console.log('=== PRE-MIGRATION RECORD COUNTS ===');
  console.log(`Collection             Source (${sourceWorkerId})    Destination (${destWorkerId})`);
  console.log(`workers                ${sourceCounts.workers.toString().padEnd(25)} ${beforeCounts.workers}`);
  console.log(`identityverifications ${sourceCounts.identityverifications.toString().padEnd(25)} ${beforeCounts.identityverifications}`);
  console.log(`evidence               ${sourceCounts.evidence.toString().padEnd(25)} ${beforeCounts.evidence}`);
  console.log(`verificationrecords    ${sourceCounts.verificationrecords.toString().padEnd(25)} ${beforeCounts.verificationrecords}`);
  console.log(`consentrequests        ${sourceCounts.consentrequests.toString().padEnd(25)} ${beforeCounts.consentrequests}`);
  console.log(`credentials            ${sourceCounts.credentials.toString().padEnd(25)} ${beforeCounts.credentials}`);
  console.log('================================================================\n');

  // Plan Cloned Records
  const evidenceIdMap = new Map<string, string>();
  const verificationIdMap = new Map<string, string>();

  // 1. Cloned Worker Profile
  const clonedWorkerPayload = {
    id: destWorkerId,
    name: primarySourceWorker.name || 'Vikram Malhotra',
    phoneNumber: primarySourceWorker.phoneNumber || '+91 98765 43210',
    email: options.destinationEmail, // MUST BE DESTINATION EMAIL
    dateOfBirth: primarySourceWorker.dateOfBirth || '1995-08-15',
    gender: primarySourceWorker.gender || 'Male',
    state: primarySourceWorker.state || 'Maharashtra',
    city: primarySourceWorker.city || 'Pune',
    workerCategory: primarySourceWorker.workerCategory || 'Delivery Partner',
    location: primarySourceWorker.location || 'Pune, Maharashtra',
  };

  // 2. Cloned IdentityVerification
  const sourceIdentity = await IdentityVerification.findOne({
    $or: [{ workerId: sourceWorkerId }, { workerId: 'OS-DEMO-001' }],
  }).lean();

  const clonedIdentityPayload = {
    workerId: destWorkerId,
    provider: 'SETU_DIGILOCKER',
    requestId: `mock_req_sadhana_${Date.now()}`,
    status: sourceIdentity ? sourceIdentity.status : 'VERIFIED',
    validUpto: new Date(Date.now() + 3600000 * 24),
    verifiedAt: new Date(),
  };

  // 3. Cloned Evidence Records
  const sourceEvidences = await Evidence.find({
    $or: [{ workerId: sourceWorkerId }, { workerId: 'OS-DEMO-001' }, { source: { $in: ['DECLARED', 'OBSERVED', 'FINANCIAL'] } }],
  }).lean();

  // Deduplicate source evidences by platform/type to get 1 set of 4 benchmark evidences
  const uniqueEvidencesMap = new Map<string, any>();
  for (const ev of sourceEvidences) {
    const key = `${ev.source}_${ev.platform}_${ev.type}_${ev.amount}`;
    if (!uniqueEvidencesMap.has(key)) {
      uniqueEvidencesMap.set(key, ev);
    }
  }
  const benchmarkEvidences = Array.from(uniqueEvidencesMap.values());

  const clonedEvidences: any[] = [];
  for (let i = 0; i < benchmarkEvidences.length; i++) {
    const srcEv = benchmarkEvidences[i];
    const newId = `ev-sadhana-${srcEv.source.toLowerCase()}-${(i + 1).toString().padStart(3, '0')}`;
    evidenceIdMap.set(srcEv.id, newId);

    clonedEvidences.push({
      id: newId,
      workerId: destWorkerId,
      source: srcEv.source,
      type: srcEv.type,
      platform: srcEv.platform,
      timestamp: srcEv.timestamp,
      amount: srcEv.amount,
      currency: srcEv.currency || 'INR',
      reference: srcEv.reference,
      metadata: srcEv.metadata || {},
      capturedAt: srcEv.capturedAt || new Date().toISOString(),
      previousHash: srcEv.previousHash,
      integrityHash: srcEv.integrityHash,
      declaredNotes: srcEv.declaredNotes,
      packageName: srcEv.packageName,
      rawTextSnippet: srcEv.rawTextSnippet,
      bankName: srcEv.bankName,
      accountMask: srcEv.accountMask,
      transactionRef: srcEv.transactionRef,
    });
  }

  // 4. Cloned VerificationRecord
  const sourceVerification = await VerificationRecord.findOne({
    $or: [{ workerId: sourceWorkerId }, { workerId: 'OS-DEMO-001' }],
  }).sort({ computedAt: -1 }).lean();

  const newVerificationId = `vr-sadhana-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const clonedEvidenceIds = clonedEvidences.map((e) => e.id);

  const clonedVerificationPayload = {
    id: newVerificationId,
    workerId: destWorkerId,
    payoutPeriod: sourceVerification ? sourceVerification.payoutPeriod : { startDate: '2026-08-01', endDate: '2026-08-07' },
    level: sourceVerification ? sourceVerification.level : 'FINANCIALLY_CORROBORATED',
    confidence: sourceVerification ? sourceVerification.confidence : 0.96,
    reason: sourceVerification ? sourceVerification.reason : 'Financial settlement corroborates claimed payout.',
    supportingEvidence: clonedEvidenceIds,
    limitations: sourceVerification ? sourceVerification.limitations : 'None. Full financial corroboration established.',
    evidenceIds: clonedEvidenceIds,
    identityVerified: true,
    reconciliationStatus: sourceVerification ? sourceVerification.reconciliationStatus : 'MATCHED',
    expectedGross: sourceVerification ? sourceVerification.expectedGross : 30100,
    authorizedDeductions: sourceVerification ? sourceVerification.authorizedDeductions : 0,
    expectedNet: sourceVerification ? sourceVerification.expectedNet : 30100,
    actualSettlement: sourceVerification ? sourceVerification.actualSettlement : 30100,
    engineSource: 'PYTHON_VERIFICATION_ENGINE',
    verificationSource: 'AUTHORITATIVE_ENGINE',
    verificationEngineVersion: '1.0.0',
    computedAt: new Date(),
  };

  // 5. Cloned ConsentRequest
  const newConsentId = `mock-consent-sadhana-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const clonedConsentPayload = {
    consentId: newConsentId,
    workerId: destWorkerId,
    fiTypes: ['DEPOSIT'],
    status: 'ACTIVE',
    consentUrl: `http://localhost:4000/api/v1/mock-aa/consent/${newConsentId}`,
    isMock: true,
    fipId: 'onshift-mock-fip',
    approvedAt: new Date(),
  };

  // 6. Cryptographically Valid Credential for Sadhana
  const credentialClaims = {
    verifiedIncome: clonedVerificationPayload.expectedNet,
    period: `${clonedVerificationPayload.payoutPeriod.startDate} to ${clonedVerificationPayload.payoutPeriod.endDate}`,
    verificationLevel: clonedVerificationPayload.level,
    identityVerified: true,
    platformBreakdown: {
      Zomato: 15400,
      Swiggy: 14700,
    },
  };

  const signedCred = signCredential(
    destWorkerId,
    credentialClaims as any,
    config.ed25519PrivateKeyHex,
    config.ed25519PublicKeyHex,
    config.issuerName
  );

  const clonedCredentialPayload = {
    type: 'OnShiftIncomeCredential',
    credentialType: 'OnShiftIncomeCredential',
    issuer: config.issuerName,
    publicKeyHex: config.ed25519PublicKeyHex,
    issuerPublicKey: config.ed25519PublicKeyHex,
    workerId: destWorkerId,
    verificationId: newVerificationId,
    issuedAt: signedCred.issuedAt,
    validUntil: signedCred.validUntil,
    claims: credentialClaims,
    signature: signedCred.signature,
  };

  if (options.dryRun && !options.apply) {
    console.log('=== DRY-RUN PLAN GENERATED ===');
    console.log('Worker Profile Payload:');
    console.log(JSON.stringify(clonedWorkerPayload, null, 2));
    console.log('\nIdentityVerification Payload:');
    console.log(JSON.stringify(clonedIdentityPayload, null, 2));
    console.log(`\nEvidence Payloads (${clonedEvidences.length} items):`);
    console.log(JSON.stringify(clonedEvidences, null, 2));
    console.log('\nVerificationRecord Payload:');
    console.log(JSON.stringify(clonedVerificationPayload, null, 2));
    console.log('\nConsentRequest Payload:');
    console.log(JSON.stringify(clonedConsentPayload, null, 2));
    console.log('\nCryptographically Signed Credential Payload:');
    console.log(JSON.stringify(clonedCredentialPayload, null, 2));
    console.log('\n================================================================');
    console.log('To execute this migration and persist to MongoDB Atlas, run:');
    console.log('  npm run clone-worker -- --apply');
    console.log('================================================================\n');
    return;
  }

  // Execute Writes
  console.log('=== EXECUTING DATABASE MIGRATION WRITES ===');

  // 1. Worker Profile
  await Worker.findOneAndUpdate({ id: destWorkerId }, { $set: clonedWorkerPayload }, { upsert: true, new: true });
  console.log(`✓ Worker profile upserted for ${destWorkerId}`);

  // 2. IdentityVerification
  await IdentityVerification.findOneAndUpdate({ workerId: destWorkerId }, { $set: clonedIdentityPayload }, { upsert: true, new: true });
  console.log(`✓ IdentityVerification record upserted for ${destWorkerId}`);

  // 3. Evidences
  for (const evDoc of clonedEvidences) {
    await Evidence.findOneAndUpdate({ id: evDoc.id }, { $set: evDoc }, { upsert: true, new: true });
  }
  console.log(`✓ ${clonedEvidences.length} Evidence documents upserted for ${destWorkerId}`);

  // 4. VerificationRecord
  await VerificationRecord.findOneAndUpdate({ id: newVerificationId }, { $set: clonedVerificationPayload }, { upsert: true, new: true });
  console.log(`✓ VerificationRecord ${newVerificationId} upserted for ${destWorkerId}`);

  // 5. ConsentRequest
  await ConsentRequest.findOneAndUpdate({ consentId: newConsentId }, { $set: clonedConsentPayload }, { upsert: true, new: true });
  console.log(`✓ ConsentRequest ${newConsentId} upserted for ${destWorkerId}`);

  // 6. Credential
  await Credential.findOneAndUpdate({ workerId: destWorkerId, verificationId: newVerificationId }, { $set: clonedCredentialPayload }, { upsert: true, new: true });
  console.log(`✓ Cryptographically signed Credential upserted for ${destWorkerId}`);

  // Post-Migration Audit Verification
  const afterCounts = {
    workers: await Worker.countDocuments({ id: destWorkerId }),
    identityverifications: await IdentityVerification.countDocuments({ workerId: destWorkerId }),
    evidence: await Evidence.countDocuments({ workerId: destWorkerId }),
    verificationrecords: await VerificationRecord.countDocuments({ workerId: destWorkerId }),
    consentrequests: await ConsentRequest.countDocuments({ workerId: destWorkerId }),
    credentials: await Credential.countDocuments({ workerId: destWorkerId }),
  };

  console.log('\n=== POST-MIGRATION RECORD COUNTS ===');
  console.log(`Collection             Source (${sourceWorkerId})    Destination (${destWorkerId})`);
  console.log(`workers                ${sourceCounts.workers.toString().padEnd(25)} ${afterCounts.workers}`);
  console.log(`identityverifications ${sourceCounts.identityverifications.toString().padEnd(25)} ${afterCounts.identityverifications}`);
  console.log(`evidence               ${sourceCounts.evidence.toString().padEnd(25)} ${afterCounts.evidence}`);
  console.log(`verificationrecords    ${sourceCounts.verificationrecords.toString().padEnd(25)} ${afterCounts.verificationrecords}`);
  console.log(`consentrequests        ${sourceCounts.consentrequests.toString().padEnd(25)} ${afterCounts.consentrequests}`);
  console.log(`credentials            ${sourceCounts.credentials.toString().padEnd(25)} ${afterCounts.credentials}`);
  console.log('================================================================\n');

  // Verify Credential Cryptographic Signature
  const verifyRes = verifyCredentialSignature(signedCred, {
    issuer: config.issuerName,
    publicKeyHex: config.ed25519PublicKeyHex,
  });

  console.log('=== CRYPTOGRAPHIC CREDENTIAL VERIFICATION ===');
  console.log(`Credential Valid:      ${verifyRes.valid}`);
  console.log(`Signature Verified:    ${verifyRes.signatureVerified}`);
  console.log(`Issuer Verified:       ${verifyRes.issuerVerified}`);
  console.log(`Subject (workerId):    ${verifyRes.workerId}`);
  console.log(`Message:               ${verifyRes.message}`);
  console.log('================================================================\n');

  if (!verifyRes.valid) {
    throw new Error(`Cryptographic verification failed for Sadhana credential: ${verifyRes.message}`);
  }

  console.log('🎉 MIGRATION SUCCESSFULLY COMPLETED & CRYPTOGRAPHICALLY VERIFIED!');
}

if (require.main === module) {
  runCloning()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\n❌ MIGRATION ERROR:', err);
      process.exit(1);
    });
}
