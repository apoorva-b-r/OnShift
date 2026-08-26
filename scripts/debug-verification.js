/**
 * Debug: calls the Python engine directly with the canonical evidence set,
 * then replicates the backend's VerificationRecord.create to expose the
 * real Mongoose error. Safe to delete afterwards.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'apps', 'backend', '.env') });
const mongoose = require('mongoose');

const PAYOUT_PERIOD = { startDate: '2026-08-01', endDate: '2026-08-07' };

(async () => {
  // 1. Load evidence from DB exactly like the backend does
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.useDb('onshift');
  const rawEvidence = await db.collection('evidences').find({ workerId: 'OS-DEMO-001' }).toArray();
  console.log('DB evidence count:', rawEvidence.length);

  // 2. Normalize like evidenceAdapter (minimal inline version)
  const evidences = rawEvidence.map((ev) => ({
    id: ev.id,
    workerId: ev.workerId,
    source: ev.source,
    type: ev.type,
    category: ev.category,
    role: ev.role,
    platform: ev.platform,
    timestamp: ev.timestamp,
    amount: ev.amount,
    currency: ev.currency || 'INR',
    reference: ev.reference || ev.transactionRef || '',
    metadata: ev.metadata || {},
    previousHash: ev.previousHash || '',
    integrityHash: ev.integrityHash || '',
    capturedAt: ev.capturedAt || new Date().toISOString(),
  }));
  const evidenceIds = evidences.map((e) => e.id);
  console.log('evidenceIds:', evidenceIds.join(', '));

  // 3. Call the Python engine directly
  const verRes = await fetch('http://localhost:8000/verification/level', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workerId: 'OS-DEMO-001', payoutPeriod: PAYOUT_PERIOD, evidenceIds, evidences }),
  });
  const verBody = await verRes.json();
  console.log('ENGINE /verification/level status:', verRes.status);
  console.log('ENGINE ver result:', JSON.stringify(verBody, null, 2));

  const reconRes = await fetch('http://localhost:8000/reconciliation/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workerId: 'OS-DEMO-001', payoutPeriod: PAYOUT_PERIOD, evidenceIds, evidences }),
  });
  const reconBody = await reconRes.json();
  console.log('ENGINE /reconciliation/run status:', reconRes.status);
  console.log('ENGINE recon status:', reconBody.status, '| expectedNet:', reconBody.expectedNet, '| actualSettlement:', reconBody.actualSettlement);

  // 4. Replicate the backend's VerificationRecord.create
  const VerificationRecord = mongoose.model(
    'VerificationRecord',
    new mongoose.Schema({
      id: { type: String, required: true, unique: true },
      workerId: { type: String, required: true },
      payoutPeriod: new mongoose.Schema({ startDate: String, endDate: String }, { _id: false }),
      level: { type: String, enum: ['DECLARED', 'OBSERVED', 'CORROBORATED', 'FINANCIALLY_CORROBORATED'] },
      confidence: Number,
      reason: String,
      supportingEvidence: [String],
      limitations: String,
      evidenceIds: [String],
      identityVerified: Boolean,
      reconciliationStatus: String,
      expectedGross: Number,
      authorizedDeductions: Number,
      expectedNet: Number,
      actualSettlement: Number,
      engineSource: String,
      verificationSource: String,
      verificationEngineVersion: String,
      computedAt: String,
    }, { versionKey: false }),
    'verificationrecords'
  );

  try {
    const rec = await VerificationRecord.create({
      id: 'vr-debug-' + Date.now().toString(36),
      workerId: 'OS-DEMO-001',
      payoutPeriod: PAYOUT_PERIOD,
      level: verBody.level,
      confidence: verBody.confidence,
      reason: verBody.reason,
      supportingEvidence: verBody.supportingEvidence || [],
      limitations: Array.isArray(verBody.limitations) ? verBody.limitations.join(' | ') : verBody.limitations || '',
      evidenceIds,
      identityVerified: false,
      reconciliationStatus: reconBody.status,
      expectedGross: reconBody.expectedGross,
      authorizedDeductions: reconBody.knownDeductions ?? 0,
      expectedNet: reconBody.expectedNet,
      actualSettlement: reconBody.actualSettlement,
      engineSource: 'PYTHON_VERIFICATION_ENGINE',
      verificationSource: 'AUTHORITATIVE_ENGINE',
      verificationEngineVersion: '1.0.0',
      computedAt: new Date().toISOString(),
    });
    console.log('RECORD CREATE OK:', rec.id, '| level:', rec.level);
  } catch (err) {
    console.error('RECORD CREATE FAILED:', err.name, '-', err.message);
    if (err.errors) console.error('Validation details:', JSON.stringify(err.errors, null, 2));
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error('DEBUG FAIL:', e.message);
  process.exit(1);
});