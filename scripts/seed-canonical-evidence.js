/**
 * Seeds the canonical Scenario-1 evidence set into MongoDB (onshift.evidences)
 * and removes old mock-transaction pollution (ev-fin-txn-*).
 *
 * Canonical set (from @onshift/mock-data):
 *   ev-decl-001        DECLARED  SELF_REPORTED_PAYOUT   30500 (Aggregated)
 *   ev-obs-zomato-001  OBSERVED  NOTIFICATION_PAYOUT    18200 (Zomato)
 *   ev-obs-swiggy-001  OBSERVED  NOTIFICATION_PAYOUT    12300 (Swiggy)
 *   ev-fin-hdfc-001    FINANCIAL AA_BANK_SETTLEMENT     30100 (HDFC, attributable remitter)
 *
 * Reconciliation: 30500 gross - 400 kit deduction = 30100 == settlement -> MATCHED
 * Verification level: FINANCIALLY_CORROBORATED
 *
 * Usage: node scripts/seed-canonical-evidence.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'apps', 'backend', '.env') });
const mongoose = require('mongoose');
const path = require('path');

const {
  DEMO_DECLARED_EVIDENCE,
  DEMO_OBSERVED_EVIDENCE_ZOMATO,
  DEMO_OBSERVED_EVIDENCE_SWIGGY,
  DEMO_FINANCIAL_EVIDENCE_SCENARIO_1,
} = require(path.join(__dirname, '..', 'packages', 'mock-data', 'dist'));

const CANONICAL = [
  DEMO_DECLARED_EVIDENCE,
  DEMO_OBSERVED_EVIDENCE_ZOMATO,
  DEMO_OBSERVED_EVIDENCE_SWIGGY,
  DEMO_FINANCIAL_EVIDENCE_SCENARIO_1,
];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.useDb('onshift');
  const evidences = db.collection('evidences');

  // 1. Remove old mock-transaction pollution from earlier demo runs
  const del = await evidences.deleteMany({ id: { $regex: /^ev-fin-txn-/ } });
  console.log('Removed old ev-fin-txn-* records:', del.deletedCount);

  // 2. Upsert canonical evidence set
  for (const ev of CANONICAL) {
    await evidences.updateOne({ id: ev.id }, { $set: ev }, { upsert: true });
    console.log('Seeded:', ev.id, '|', ev.source, '|', ev.amount, ev.currency);
  }

  const total = await evidences.countDocuments();
  console.log('onshift.evidences total docs:', total);

  await mongoose.disconnect();
  console.log('SEED COMPLETE');
})().catch((err) => {
  console.error('SEED FAILED:', err.message);
  process.exit(1);
});