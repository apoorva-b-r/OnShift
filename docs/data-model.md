# OnShift Data Model

OnShift uses a domain data model designed for local-first storage, tamper-evident hash chaining, and pseudonymous verification.

## Core Entities

### 1. Worker
```typescript
interface Worker {
  id: string; // Pseudonymous ID e.g., OS-DEMO-001
  name?: string; // Kept local or omitted in credentials
  createdAt: string;
  updatedAt: string;
}
```

### 2. Evidence
```typescript
type EvidenceSource = 'DECLARED' | 'OBSERVED' | 'FINANCIAL';

interface Evidence {
  id: string;
  workerId: string;
  source: EvidenceSource;
  type: string; // e.g. ORDER_PAYOUT, BANK_SETTLEMENT, SELF_REPORT
  platform: string; // e.g. Zomato, Swiggy, Uber, HDFC Bank
  timestamp: string;
  amount: number;
  currency: string;
  reference: string;
  metadata: Record<string, any>;
  capturedAt: string;
  previousHash: string;
  integrityHash: string;
}
```

### 3. PayoutPeriod
```typescript
interface PayoutPeriod {
  startDate: string;
  endDate: string;
}
```

### 4. ReconciliationResult
```typescript
type ReconciliationStatus =
  | 'MATCHED'
  | 'EXPLAINED_DIFFERENCE'
  | 'UNEXPLAINED_DIFFERENCE'
  | 'INSUFFICIENT_EVIDENCE';

interface Discrepancy {
  category: string;
  expectedAmount: number;
  actualAmount: number;
  difference: number;
  isExplained: boolean;
  explanationNote: string;
}

interface ReconciliationResult {
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
```

### 5. VerificationResult
```typescript
type VerificationLevel =
  | 'DECLARED'
  | 'OBSERVED'
  | 'CORROBORATED'
  | 'FINANCIALLY_CORROBORATED';

interface VerificationResult {
  level: VerificationLevel;
  confidence: number;
  reason: string;
  supportingEvidence: string[];
  limitations: string;
}
```

### 6. Credential & Claims
```typescript
interface CredentialClaim {
  verifiedIncome: number;
  period: string;
  verificationLevel: VerificationLevel;
  platformCount?: number;
  breakdown?: Record<string, number>;
}

interface Credential {
  credentialType: string;
  issuer: string;
  issuerPublicKey: string;
  workerId: string;
  issuedAt: string;
  validUntil: string;
  claims: CredentialClaim;
  signature: string;
}
```

### 7. GovernmentScheme & SchemeMatch
```typescript
interface GovernmentScheme {
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

interface SchemeMatch {
  scheme: GovernmentScheme;
  matchReason: string;
  possibleEligibility: boolean;
  requiredDocuments: string[];
}
```
