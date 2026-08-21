import {
  Worker,
  DeclaredEvidence,
  ObservedEvidence,
  FinancialEvidence,
  GovernmentScheme,
  ReconciliationResult,
  VerificationResult,
} from '@onshift/shared-types';

export const DEMO_WORKER: Worker = {
  id: 'OS-DEMO-001',
  name: 'Ravi Kumar',
  phoneHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-20T23:24:49.000Z',
};

export const DEMO_DECLARED_EVIDENCE: DeclaredEvidence = {
  id: 'ev-decl-001',
  workerId: 'OS-DEMO-001',
  source: 'DECLARED',
  type: 'SELF_REPORTED_PAYOUT',
  platform: 'Aggregated (Zomato + Swiggy)',
  timestamp: '2026-08-07T20:00:00.000Z',
  amount: 30500,
  currency: 'INR',
  reference: 'DECL-WEEK-32-2026',
  metadata: { period: '01 Aug to 07 Aug 2026' },
  capturedAt: '2026-08-07T20:05:00.000Z',
  declaredNotes: 'Expected gross weekly earnings from food delivery',
  previousHash: 'GENESIS_0000000000000000000000000000000000000000000000000000000000000000',
  integrityHash: 'a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8',
};

export const DEMO_OBSERVED_EVIDENCE_ZOMATO: ObservedEvidence = {
  id: 'ev-obs-zomato-001',
  workerId: 'OS-DEMO-001',
  source: 'OBSERVED',
  type: 'NOTIFICATION_PAYOUT',
  platform: 'Zomato',
  timestamp: '2026-08-07T22:15:00.000Z',
  amount: 18200,
  currency: 'INR',
  reference: 'ZOMATO-PAY-8842',
  packageName: 'com.application.zomato',
  rawTextSnippet: 'Zomato Payout: Weekly payout of INR 18,200 processed to your linked account.',
  metadata: { ordersCompleted: 142, rating: 4.9 },
  capturedAt: '2026-08-07T22:15:05.000Z',
  previousHash: 'a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8',
  integrityHash: 'b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b9c0',
};

export const DEMO_OBSERVED_EVIDENCE_SWIGGY: ObservedEvidence = {
  id: 'ev-obs-swiggy-001',
  workerId: 'OS-DEMO-001',
  source: 'OBSERVED',
  type: 'NOTIFICATION_PAYOUT',
  platform: 'Swiggy',
  timestamp: '2026-08-07T22:30:00.000Z',
  amount: 12300,
  currency: 'INR',
  reference: 'SWIGGY-PAY-9913',
  packageName: 'in.swiggy.android',
  rawTextSnippet: 'Swiggy Delivery: Weekly transfer of INR 12,300 dispatched.',
  metadata: { ordersCompleted: 98, rating: 4.8 },
  capturedAt: '2026-08-07T22:30:04.000Z',
  previousHash: 'b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b9c0',
  integrityHash: 'c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b9c0d1',
};

export const DEMO_FINANCIAL_EVIDENCE_SCENARIO_1: FinancialEvidence = {
  id: 'ev-fin-hdfc-001',
  workerId: 'OS-DEMO-001',
  source: 'FINANCIAL',
  type: 'AA_BANK_SETTLEMENT',
  platform: 'HDFC Bank',
  bankName: 'HDFC Bank',
  accountMask: 'XX4821',
  transactionRef: 'NEFT-GIGPAY-30100-20260808',
  timestamp: '2026-08-08T06:00:00.000Z',
  amount: 30100,
  currency: 'INR',
  reference: 'TXN-HDFC-994821',
  metadata: {
    remitter: 'Gig Platform Escrow Private Limited',
    deductions: [{ category: 'Uniform & Equipment Deduction', amount: 400 }],
  },
  capturedAt: '2026-08-08T06:05:00.000Z',
  previousHash: 'c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b9c0d1',
  integrityHash: 'd0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b9c0d1e2',
};

export const DEMO_FINANCIAL_EVIDENCE_SCENARIO_2: FinancialEvidence = {
  id: 'ev-fin-hdfc-002',
  workerId: 'OS-DEMO-001',
  source: 'FINANCIAL',
  type: 'AA_BANK_SETTLEMENT',
  platform: 'HDFC Bank',
  bankName: 'HDFC Bank',
  accountMask: 'XX4821',
  transactionRef: 'NEFT-GIGPAY-29500-20260808',
  timestamp: '2026-08-08T06:00:00.000Z',
  amount: 29500,
  currency: 'INR',
  reference: 'TXN-HDFC-994822',
  metadata: {
    remitter: 'Gig Platform Escrow Private Limited',
    deductions: [],
  },
  capturedAt: '2026-08-08T06:05:00.000Z',
  previousHash: 'c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b9c0d1',
  integrityHash: 'e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b9c0d1e2f3',
};

export const DEMO_RECONCILIATION_SCENARIO_1: ReconciliationResult = {
  expectedAmount: 30500,
  knownDeductions: 400,
  expectedSettlement: 30100,
  actualSettlement: 30100,
  difference: 0,
  status: 'MATCHED',
  explanation: 'Expected gross platform earnings of INR 30,500 minus known uniform deductions of INR 400 matches actual bank deposit of INR 30,100 exactly.',
  supportingEvidenceIds: [
    'ev-decl-001',
    'ev-obs-zomato-001',
    'ev-obs-swiggy-001',
    'ev-fin-hdfc-001',
  ],
  discrepancyDetails: [
    {
      category: 'Equipment Charge',
      expectedAmount: 30500,
      actualAmount: 30100,
      difference: 400,
      isExplained: true,
      explanationNote: 'Authorized weekly kit charge deduction by platform',
    },
  ],
};

export const DEMO_RECONCILIATION_SCENARIO_2: ReconciliationResult = {
  expectedAmount: 30100,
  knownDeductions: 0,
  expectedSettlement: 30100,
  actualSettlement: 29500,
  difference: 600,
  status: 'UNEXPLAINED_DIFFERENCE',
  explanation: 'Actual bank deposit of INR 29,500 is lower than expected payout of INR 30,100 by INR 600 with no documented platform deduction record.',
  supportingEvidenceIds: [
    'ev-decl-001',
    'ev-obs-zomato-001',
    'ev-obs-swiggy-001',
    'ev-fin-hdfc-002',
  ],
  discrepancyDetails: [
    {
      category: 'Unmapped Settlement Shortfall',
      expectedAmount: 30100,
      actualAmount: 29500,
      difference: 600,
      isExplained: false,
      explanationNote: 'Discrepancy detected between observed notifications and bank credit',
    },
  ],
};

export const DEMO_VERIFICATION_SCENARIO_1: VerificationResult = {
  level: 'FINANCIALLY_CORROBORATED',
  confidence: 0.96,
  reason: 'Observed platform order notifications reconcile with bank settlement records via Account Aggregator flow.',
  supportingEvidence: [
    'ev-decl-001',
    'ev-obs-zomato-001',
    'ev-obs-swiggy-001',
    'ev-fin-hdfc-001',
  ],
  limitations: 'Prototype verification heuristic score.',
};

export const DEMO_VERIFICATION_SCENARIO_2: VerificationResult = {
  level: 'CORROBORATED',
  confidence: 0.72,
  reason: 'Platform notifications corroborate declared income but an unexplained shortfall of INR 600 was detected in the bank settlement. Income is corroborated but not fully financially reconciled.',
  supportingEvidence: [
    'ev-decl-001',
    'ev-obs-zomato-001',
    'ev-obs-swiggy-001',
    'ev-fin-hdfc-002',
  ],
  limitations: 'Unexplained settlement discrepancy prevents FINANCIALLY_CORROBORATED classification.',
};

export const DEMO_GOVERNMENT_SCHEMES: GovernmentScheme[] = [
  {
    id: 'SCHEME-ESHRAM-PENSION',
    name: 'e-Shram Pension Scheme (PM-SYM)',
    description: 'Voluntary pension scheme for unorganized gig workers offering INR 3,000 monthly pension upon reaching 60 years.',
    targetWorkerTypes: ['Delivery Partner', 'Rideshare Driver', 'Gig Worker'],
    minMonthlyIncome: 0,
    maxMonthlyIncome: 15000,
    eligibilityRules: [
      'Worker must be in unorganized sector',
      'Monthly income within eligible window',
      'Age between 18 and 40 years',
    ],
    documents: ['Aadhaar Card', 'Bank Passbook / AA Consent', 'e-Shram UWIN Card'],
    applicationUrl: 'https://eshram.gov.in',
    status: 'ACTIVE',
  },
  {
    id: 'SCHEME-PMSVANIDHI',
    name: 'PM SVANidhi Micro Credit Scheme',
    description: 'Special micro-credit facility providing affordable working capital loans up to INR 50,000 for urban micro-entrepreneurs and delivery partners.',
    targetWorkerTypes: ['Gig Worker', 'Street Vendor', 'Micro Partner'],
    minMonthlyIncome: 5000,
    maxMonthlyIncome: 50000,
    eligibilityRules: [
      'Active gig work proof over minimum 3 months',
      'Financially corroborated bank income proof',
    ],
    documents: ['OnShift Signed Credential', 'Aadhaar Card', 'Bank Statement'],
    applicationUrl: 'https://pmsvanidhi.mohua.gov.in',
    status: 'ACTIVE',
  },
  {
    id: 'SCHEME-AYUSHMAN-BHARAT',
    name: 'Ayushman Bharat Pradhan Mantri Jan Arogya Yojana',
    description: 'National health protection scheme providing health coverage up to INR 5,000,000 per family per year for secondary and tertiary care hospitalization.',
    targetWorkerTypes: ['Gig Worker', 'Low-Income Family'],
    minMonthlyIncome: 0,
    maxMonthlyIncome: 25000,
    eligibilityRules: [
      'Deprivation criteria under SECC 2011 or active unorganized worker registration',
    ],
    documents: ['Aadhaar Card', 'Ration Card', 'OnShift Verification Summary'],
    applicationUrl: 'https://pmjay.gov.in',
    status: 'ACTIVE',
  },
];
