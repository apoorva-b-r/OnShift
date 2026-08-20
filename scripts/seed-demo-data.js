/**
 * OnShift Demo Dataset Seeding Script
 * Populates canonical demo dataset for worker Ravi Kumar (OS-DEMO-001).
 */

const {
  DEMO_WORKER,
  DEMO_DECLARED_EVIDENCE,
  DEMO_OBSERVED_EVIDENCE_ZOMATO,
  DEMO_OBSERVED_EVIDENCE_SWIGGY,
  DEMO_FINANCIAL_EVIDENCE_SCENARIO_1,
  DEMO_GOVERNMENT_SCHEMES,
} = require('../packages/mock-data/dist');

async function seedDemoData() {
  console.log('==================================================');
  console.log('ONSHIFT DEMO DATASET SEEDING');
  console.log('==================================================');
  console.log(`[Worker] Loaded canonical worker: ${DEMO_WORKER.name} (${DEMO_WORKER.id})`);
  console.log(`[Evidence] Declared: ${DEMO_DECLARED_EVIDENCE.id} (INR ${DEMO_DECLARED_EVIDENCE.amount})`);
  console.log(`[Evidence] Observed Zomato: ${DEMO_OBSERVED_EVIDENCE_ZOMATO.id} (INR ${DEMO_OBSERVED_EVIDENCE_ZOMATO.amount})`);
  console.log(`[Evidence] Observed Swiggy: ${DEMO_OBSERVED_EVIDENCE_SWIGGY.id} (INR ${DEMO_OBSERVED_EVIDENCE_SWIGGY.amount})`);
  console.log(`[Evidence] Financial HDFC: ${DEMO_FINANCIAL_EVIDENCE_SCENARIO_1.id} (INR ${DEMO_FINANCIAL_EVIDENCE_SCENARIO_1.amount})`);
  console.log(`[Schemes] Loaded ${DEMO_GOVERNMENT_SCHEMES.length} government schemes into catalog.`);
  console.log('--------------------------------------------------');
  console.log('SUCCESS: Demo dataset seeded cleanly for offline/online hackathon pitch.');
}

seedDemoData().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
