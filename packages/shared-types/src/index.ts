// ==================================================
// ONSHIFT DOMAIN TYPES & CONTRACTS
// ==================================================

export type EvidenceSource = 'DECLARED' | 'OBSERVED' | 'FINANCIAL';

export type ReconciliationStatus =
  | 'MATCHED'
  | 'EXPLAINED_DIFFERENCE'
  | 'UNEXPLAINED_DIFFERENCE'
  | 'INSUFFICIENT_EVIDENCE';

export type VerificationLevel =
  | 'DECLARED'
  | 'OBSERVED'
  | 'CORROBORATED'
  | 'FINANCIALLY_CORROBORATED';

export interface Worker {
  id: string; // Pseudonymous ID (e.g. OS-DEMO-001)
  name?: string;
  phoneHash?: string;
  workerCategory?: string; // e.g. "Delivery Partner", "Rideshare Driver", "Task Worker"
  location?: string; // e.g. "Pune, Maharashtra" - used by deterministic scheme filter
  createdAt: string;
  updatedAt: string;
}

export interface BaseEvidence {
  id: string;
  workerId: string;
  source: EvidenceSource;
  type: string;
  platform: string;
  timestamp: string;
  amount: number;
  currency: string;
  reference: string;
  metadata: Record<string, any>;
  capturedAt: string;
  previousHash: string;
  integrityHash: string;
}

export interface DeclaredEvidence extends BaseEvidence {
  source: 'DECLARED';
  type: 'SELF_REPORTED_PAYOUT';
  declaredNotes?: string;
}

export interface ObservedEvidence extends BaseEvidence {
  source: 'OBSERVED';
  type: 'NOTIFICATION_PAYOUT' | 'NOTIFICATION_ORDER';
  packageName?: string;
  rawTextSnippet?: string;
}

export interface FinancialEvidence extends BaseEvidence {
  source: 'FINANCIAL';
  type: 'AA_BANK_SETTLEMENT';
  bankName: string;
  accountMask: string;
  transactionRef: string;
}

export type Evidence = DeclaredEvidence | ObservedEvidence | FinancialEvidence;

export interface PayoutPeriod {
  startDate: string;
  endDate: string;
}

export interface Discrepancy {
  category: string;
  expectedAmount: number;
  actualAmount: number;
  difference: number;
  isExplained: boolean;
  explanationNote: string;
}

export interface ReconciliationResult {
  expectedAmount: number;
  knownDeductions: number;
  expectedSettlement: number;
  actualSettlement: number;
  difference: number;
  status: ReconciliationStatus;
  explanation: string;
  supportingEvidenceIds: string[];
  discrepancyDetails?: Discrepancy[];
}

export interface VerificationResult {
  level: VerificationLevel;
  confidence: number;
  reason: string;
  supportingEvidence: string[];
  limitations: string;
}

export interface PrivacyRecord {
  workerId: string;
  localVaultEncrypted: boolean;
  dataSharingConsent: boolean;
  pseudonymActive: boolean;
  lastVaultBackupAt?: string;
}

export interface SelectiveDisclosureRequest {
  includeVerifiedIncome: boolean;
  includePeriod: boolean;
  includeVerificationLevel: boolean;
  includePlatformBreakdown?: boolean;
  includeTransactionHistory?: boolean;
}

export interface CredentialClaim {
  verifiedIncome?: number;
  period?: string;
  verificationLevel?: VerificationLevel;
  platformBreakdown?: Record<string, number>;
}

export interface Credential {
  type?: string;
  credentialType?: string;
  issuer: string;
  issuerPublicKey?: string;
  publicKeyHex?: string;
  workerId: string;
  issuedAt: string;
  validUntil?: string;
  claims: CredentialClaim;
  signature: string;
}

export interface CredentialVerificationResult {
  valid: boolean;
  issuerVerified?: boolean;
  signatureVerified: boolean;
  claims?: CredentialClaim;
  issuer?: string;
  workerId?: string;
  message?: string;
}

export interface GovernmentScheme {
  id: string;
  name: string;
  description: string;
  targetWorkerTypes: string[];
  minMonthlyIncome?: number;
  maxMonthlyIncome?: number;
  eligibilityRules: string[];
  documents: string[];
  applicationUrl: string;
  status: 'ACTIVE' | 'UPCOMING';
}

export interface SchemeMatch {
  scheme: GovernmentScheme;
  matchReason: string;
  possibleEligibility: boolean;
  requiredDocuments: string[];
}
