# ON SHIFT — FULL SYSTEM ARCHITECTURE & IMPLEMENTATION AUDIT

**Date**: August 22, 2026  
**Auditor**: Lead System Architect, QA Engineer & Security Auditor  
**Repository State**: Working Tree (Commit `a628499`)  
**Overall Monorepo Test Execution**: 🟢 **98 / 98 PASSED**  
**System Verdict**: 🟢 **READY WITH LIMITATIONS (FULLY INTEGRATED DETERMINISTIC ENGINE & CREDENTIAL PIPELINE; MOCKED UPSTREAM FINANCIAL AA & DIGILOCKER OAUTH)**  

---

## 1. Core Product Flow Audit (Arrow-by-Arrow)

```
[Worker]
   │
   ▼ (IMPLEMENTED: JWT Bearer Token / authMiddleware.ts)
[Authentication / Authorization]
   │
   ▼ (PLANNED / UI ONLY: Strings in strings.xml; No API Setu / DigiLocker OAuth code)
[Identity Verification (DigiLocker / API Setu)]
   │
   ▼ (IMPLEMENTED: Notification Parsers for Zomato, Swiggy, Uber)
[Evidence Collection]
   │
   ▼ (IMPLEMENTED: EncryptedEvidenceStore.kt with AES-256-GCM & SHA-256 Hash Chain)
[Encrypted On-Device Evidence Vault]
   │
   ▼ (IMPLEMENTED: LocalEncryptedEvidenceRepository.kt - UNSYNCED -> SYNCING -> SYNCED)
[Offline Sync Queue]
   │
   ▼ (IMPLEMENTED: Express Backend POST /evidence & MongoDB Evidence Schema)
[Backend Evidence Store]
   │
   ▼ (IMPLEMENTED: evidenceAdapter.ts Normalization & Validation)
[Evidence Adapter]
   │
   ▼ (IMPLEMENTED: Python FastAPI Engine verification.py & reconciliation.py)
[Verification Engine & Financial Reconciliation]
   │
   ▼ (IMPLEMENTED: 4 Tiers: DECLARED -> OBSERVED -> CORROBORATED -> FINANCIALLY_CORROBORATED)
[Verification Level]
   │
   ▼ (IMPLEMENTED: MongoDB VerificationRecord Snapshot)
[VerificationRecord]
   │
   ▼ (IMPLEMENTED: Ed25519 Signed W3C VC via @onshift/credential-schema)
[Verifiable Credential]
   │
   ▼ (IMPLEMENTED: Standalone Verifier Portal apps/verifier-web)
[Verifier Web UI]
   │
   ▼ (NOT CONNECTED: Static JSON Mock Filtering; Does NOT validate VCs or VerificationRecords)
[Government Scheme / Benefit Layer]
```

---

## 2. Repository-Wide Component Inventory

| Component | Monorepo Path | Classification | Actual Mechanism in Code |
| :--- | :--- | :---: | :--- |
| **Android Parsers** | `apps/android/.../notifications/` | **IMPLEMENTED** | Regex amount extraction & platform package routing for Zomato, Swiggy, Uber. |
| **Encrypted Vault** | `apps/android/.../vault/` | **IMPLEMENTED** | `EncryptedEvidenceStore.kt` (AES-256-GCM + MasterKey/persistent secret). |
| **Hash Chain** | `apps/android/.../hashchain/` | **IMPLEMENTED** | SHA-256 payload link chaining starting from `GENESIS_HASH`. |
| **Offline Sync Queue**| `apps/android/.../vault/` | **IMPLEMENTED** | `UNSYNCED` $\rightarrow$ `SYNCING` $\rightarrow$ `SYNCED` state retention machine. |
| **Backend API Auth** | `apps/backend/src/middleware/` | **IMPLEMENTED** | `authMiddleware.ts` HMAC-SHA256 JWT validation & body ownership check. |
| **Backend Database** | `apps/backend/src/models/` | **IMPLEMENTED** | MongoDB Mongoose schemas (`Evidence`, `Worker`, `VerificationRecord`, `Credential`). |
| **Evidence Adapter** | `apps/backend/src/services/` | **IMPLEMENTED** | `evidenceAdapter.ts` normalizes Android evidence into canonical Python engine format. |
| **Verification Engine**| `apps/verification-engine/` | **IMPLEMENTED** | Python FastAPI microservice (`verification.py` & `reconciliation.py`). |
| **VerificationRecord**| `apps/backend/src/models/` | **IMPLEMENTED** | Immutable DB snapshot linking `verificationId` to evidence IDs & engine metrics. |
| **Credential Signer**| `packages/credential-schema/` | **IMPLEMENTED** | Ed25519 cryptographic signing & W3C Verifiable Credential payload generator. |
| **Verifier Web UI** | `apps/verifier-web/` | **IMPLEMENTED** | Standalone React web app verifying Ed25519 signatures independently. |
| **Account Aggregator**| `apps/android/.../aa/` | **MOCKED** | `MockAccountAggregatorProvider.kt` returns simulated bank deposit transactions. |
| **DigiLocker Identity**| `apps/android/.../res/values/` | **PLANNED / UI ONLY** | UI strings in `strings.xml`; zero OAuth 2.0 PKCE or API Setu code in backend/Android. |
| **Government Schemes**| `apps/backend/src/controllers/` | **MOCKED / STATIC** | `schemeController.ts` filters static `DEMO_GOVERNMENT_SCHEMES` via raw JSON. |

---

## 3. Detailed Technical Audit Findings

### 3.1 Authentication & Trust Boundary
- **JWT Implementation**: Implemented in `apps/backend/src/middleware/authMiddleware.ts`. Supports HMAC-SHA256 JWT tokens.
- **Worker Identity Derivation**: `req.user.workerId` is set by token verification. If `req.body.workerId` is passed, `authMiddleware` checks `req.body.workerId === req.user.workerId` and returns `403 Forbidden` (`WORKER_ID_MISMATCH`) if an identity mismatch occurs.
- **Protected Endpoints**: `/evidence`, `/verification/run`, `/reconciliation/run`, and `/credentials/issue` enforce token verification via `authenticateWorker`.

### 3.2 DigiLocker & API Setu Identity
- **Current Status**: **NOT IMPLEMENTED; ONLY UI/PLANNING EXISTS**.
- The backend and Android packages contain zero OAuth 2.0 PKCE code, zero authorization code exchange endpoints, and zero DigiLocker e-KYC decryption keys. UI strings exist in Android `strings.xml` (`aadhaar_desc`).

### 3.3 Android Evidence Layer & Storage
- **Parsers**: Zomato, Swiggy, and Uber parsers extract amount, timestamp, platform, category (`EARNING`/`PAYOUT`), and role (`ORDER_EVENT`/`PAYOUT_CLAIM`).
- **Data Minimization**: Raw notification body text is processed in memory and **never saved to disk or backend database**.
- **Encryption at Rest**: `EncryptedEvidenceStore.kt` uses `AES/GCM/NoPadding`. Plaintext JSON evidence is not present on disk.
- **Persistence & Survival**: Survives process death and app restart (`EvidencePersistenceTest.kt`).
- **Offline Sync Queue**: Unsynced evidence is retained locally under `UNSYNCED` status until successfully acknowledged by backend.

### 3.4 Backend Evidence Ingestion & Deduplication
- **Deduplication**: MongoDB schema `Evidence.ts` enforces a unique index on `id` (`{ unique: true, index: true }`). Duplicate sync requests return duplicate key errors without creating duplicate database records.
- **Ownership Verification**: `runAuthoritativeVerificationPipeline` verifies that all requested evidence IDs belong to `req.user.workerId`. Referencing another worker's evidence returns `403 Forbidden` (`FORBIDDEN_EVIDENCE_ACCESS`).

### 3.5 Verification & Reconciliation Engine (Python)
- **Engine Authority**: Python FastAPI engine (`app/services/verification.py` and `app/services/reconciliation.py`) is the sole authority for verification levels and financial reconciliation. Express cannot override verification results.
- **Strict Hierarchy Enforced**:
  - No AA settlement $\rightarrow$ Never `FINANCIALLY_CORROBORATED`.
  - AA Shortfall $\rightarrow$ `UNEXPLAINED_DIFFERENCE` (Top tier blocked).
  - Personal UPI transfer $\rightarrow$ Filtered out by `is_attributable_settlement()` (Cannot satisfy financial gate).
  - Duplicate notifications $\rightarrow$ Filtered out (Cannot inflate gross earnings).
  - Payout claims $\rightarrow$ Classified as `PAYOUT_CLAIM` and excluded from gross earnings sum (Prevents double counting with order events).
  - Empty evidence $\rightarrow$ Returns `INSUFFICIENT_EVIDENCE`.

### 3.6 VerificationRecord & Credential Traceability
- **Immutable Snapshot**: `VerificationRecord` stores `verificationId`, `workerId`, `payoutPeriod`, `level`, `reconciliationStatus`, `expectedGross`, `authorizedDeductions`, `expectedNet`, `actualSettlement`, `confidence`, `reason`, `supportingEvidence`, `engineSource`, `verificationEngineVersion: "1.0.0"`.
- **Credential Issuance Gate**: `handleIssueCredential` (`credentialController.ts`) requires `{ verificationId: "..." }`. It loads `VerificationRecord` from MongoDB, verifies worker ownership (`403 Forbidden` on mismatch), derives claims server-side, signs with Ed25519, and persists `Credential`.
- **Idempotency**: Repeated issuance requests for the same `verificationId` return the existing signed credential.
- **Traceability Chain**: `Credential` $\rightarrow$ `verificationId` $\rightarrow$ `VerificationRecord` $\rightarrow$ `supportingEvidence` $\rightarrow$ `Evidence`.

### 3.7 Government Schemes Layer Audit
- **Current Status**: **STATIC MOCK DATA / NOT CONNECTED TO CREDENTIALS**.
- `schemeController.ts` evaluates candidate eligibility for static schemes (`PM-SVANidhi`, `e-Shram`, `Ayushman Bharat`) by matching raw JSON request parameters (`monthlyIncome`, `workerCategory`, `location`).
- **Critical Gap**: `schemeController.ts` does **NOT** accept a Verifiable Credential (`OnShiftIncomeCredential`), does **NOT** verify Ed25519 signatures, and does **NOT** read `VerificationRecord`. Government scheme matching operates independently on raw user-supplied JSON.

---

## 4. Capability Matrix (A – E)

| Capability | Implemented? | Actual Mechanism | Evidence in Code | Current Gap |
| :--- | :---: | :--- | :--- | :--- |
| **A) Identity Verification** | **NO** | UI strings in Android `strings.xml`. | `strings.xml:16` | No API Setu / DigiLocker OAuth 2.0 PKCE code exists. |
| **B) Income Verification** | **YES** | Deterministic Python engine + Express pipeline. | `verification.py`, `verificationService.ts` | Fully operational and tested across 36 Pytest cases. |
| **C) Credential Issuance** | **YES** | Ed25519 W3C VC signer in `@onshift/credential-schema`. | `credentialController.ts`, `index.ts` | Gated by server-persisted `VerificationRecord`. |
| **D) Scheme Eligibility** | **MOCK** | Static rule filter over `DEMO_GOVERNMENT_SCHEMES`. | `schemeController.ts:27` | Filter reads raw JSON input; does NOT validate VCs. |
| **E) Scheme Application** | **NO** | External `applicationUrl` link string only. | `GovernmentScheme.ts:20` | No government portal submission API exists. |

---

## 5. Privacy & Security Audit

- **PII Storage**: No raw Aadhaar numbers, phone numbers, or notification text strings are persisted in Android disk storage or MongoDB.
- **Cryptographic Keys**: Ed25519 private signing key is stored in server-side environment variables (`config.ed25519PrivateKeyHex`) and never exposed in API responses.
- **Secrets in Repo**: No live API Setu client secrets or production database credentials exist in Git.

---

## 6. Complete Monorepo Test Execution Results

```bash
# 1. Express Backend Test Suite (apps/backend)
$ npm run build && npm run test
PASS tests/integration.test.ts
PASS tests/api.test.ts
PASS tests/pipeline.test.ts
Test Suites: 3 passed, 3 total
Tests:       43 passed, 43 total

# 2. Python Verification Engine Pytest (apps/verification-engine)
$ cd apps/verification-engine && PYTHONPATH=. python3 -m pytest -vv
======================== 36 passed, 1 warning in 0.32s =========================

# 3. Android Unit Suite (apps/android)
$ cd apps/android && ./run_unit_tests.sh
OK (19 tests)
```

- **Total System Test Execution**: **98 / 98 PASSED** (0 Failures).

---

## 7. Adversarial Verification Matrix (20 Questions & Answers)

1. **Can Worker A submit Worker B's evidence?**  
   **NO.** Backend validates that submitted evidence IDs belong to `req.user.workerId` (403 Forbidden).
2. **Can Worker A request Worker B's verification?**  
   **NO.** Verification endpoint verifies evidence ownership and derives identity from token.
3. **Can Worker A issue Worker B's credential?**  
   **NO.** `handleIssueCredential` checks `record.workerId === req.user.workerId` (403 Forbidden).
4. **Can client force verification level?**  
   **NO.** Python Verification Engine calculates level deterministically; client parameters are ignored.
5. **Can client forge income?**  
   **NO.** Credential income claims are derived strictly from `VerificationRecord.expectedNet`.
6. **Can client inject a bank settlement?**  
   **NO.** Settlement evidence must exist in DB and pass remitter attribution checks in Python.
7. **Can duplicate notifications inflate income?**  
   **NO.** MongoDB unique index on `id` and Python engine deduplication reject duplicate evidence.
8. **Can conflicting claims inflate income?**  
   **NO.** Conflicting evidence is handled conservatively and blocks top-tier verification.
9. **Can a personal UPI transfer become a settlement?**  
   **NO.** `is_attributable_settlement()` filters out `"PERSONAL"` and `"UPI TRANSFER"` remitters.
10. **Can a corrupted evidence record become trusted?**  
    **NO.** Decryption failure sets `isVaultCorrupted = true` and rejects the record.
11. **Can deleted local evidence disappear permanently?**  
    **NO.** Synced evidence is backed up in MongoDB backend database.
12. **Can failed sync lose evidence?**  
    **NO.** Unsynced records remain in local vault (`UNSYNCED`) and retry upon network availability.
13. **Can repeated sync duplicate backend records?**  
    **NO.** MongoDB `id` unique index rejects duplicate sync writes.
14. **Can credential claims be changed before signing?**  
    **NO.** Claims are assembled server-side directly from `VerificationRecord` before signing.
15. **Can credential be issued without verification?**  
    **NO.** Requiring a valid `verificationId` prevents unverified credential issuance.
16. **Can credential be issued twice?**  
    **NO.** Credential issuance is idempotent; repeated calls return the existing signed VC.
17. **Can verifier detect a modified credential?**  
    **YES.** Ed25519 signature verification fails if any claim or key is altered.
18. **Can unauthenticated user call protected routes?**  
    **NO.** `authenticateWorker` middleware enforces token checks on protected routes.
19. **Can someone fake DigiLocker verification?**  
    **N/A.** DigiLocker integration is currently planned/UI only; no live API exists to bypass.
20. **Can someone claim government-scheme eligibility without actual scheme integration?**  
    **YES.** Scheme matching currently operates over static mock rules and does NOT validate VCs.

---

## 8. Documentation Claim Audit (Safe to Claim vs. Do Not Claim)

### 🟢 SAFE TO CLAIM:
- "OnShift features an AES-256-GCM encrypted Android evidence vault with SHA-256 hash chaining."
- "The Verification Engine deterministically reconciles gig earnings against bank settlements across 4 strict verification tiers."
- "Verifiable credentials are cryptographically signed using Ed25519 and verified independently by a Verifier Web Portal."
- "The backend pipeline enforces strict worker authentication, IDOR protection, and idempotent credential issuance."

### ⚠️ DO NOT CLAIM YET:
- *Do NOT claim live DigiLocker or API Setu Aadhaar verification* (Currently UI strings only).
- *Do NOT claim live Account Aggregator bank sandbox integration* (Currently simulated via mock providers).
- *Do NOT claim that government schemes directly ingest or validate Verifiable Credentials* (Scheme matching currently uses static JSON rule filters).

---

## 9. Final System Status Board & Layer Scores

| Layer | Status | Score | Main Gap / Limitation |
| :--- | :---: | :---: | :--- |
| **Android Evidence Layer** | 🟢 **GREEN** | 10 / 10 | Parsers & encrypted vault fully functional and tested. |
| **Offline Sync Queue** | 🟢 **GREEN** | 10 / 10 | UNSYNCED queue & MongoDB idempotency fully functional. |
| **Express Backend API** | 🟢 **GREEN** | 9 / 10 | Auth middleware, route protection, and ownership checks complete. |
| **Verification Engine** | 🟢 **GREEN** | 10 / 10 | Deterministic 4-tier Python engine verified via 36 Pytest cases. |
| **Reconciliation Math** | 🟢 **GREEN** | 10 / 10 | Deduction matching, double-counting & personal transfer filters active. |
| **Verifiable Credentials**| 🟢 **GREEN** | 10 / 10 | Ed25519 W3C VC signing gated by immutable VerificationRecord. |
| **Verifier Web Portal** | 🟢 **GREEN** | 10 / 10 | Standalone React portal verifies Ed25519 signatures independently. |
| **Account Aggregator** | 🟡 **YELLOW** | 6 / 10 | Logic fully tested; upstream data simulated via `MockAccountAggregatorProvider`. |
| **Identity / DigiLocker** | 🔴 **RED** | 2 / 10 | UI strings only; no API Setu / DigiLocker OAuth 2.0 PKCE implementation. |
| **Government Schemes** | 🟡 **YELLOW** | 4 / 10 | Static rule filter; not connected to Verifiable Credential validation. |
| **Privacy & Security** | 🟢 **GREEN** | 9 / 10 | Data minimization enforced; raw notification text never stored. |

---

### Final Monorepo Verdict: 🟢 **READY WITH LIMITATIONS**

The core **Evidence $\rightarrow$ Persistence $\rightarrow$ Sync $\rightarrow$ Verification $\rightarrow$ Reconciliation $\rightarrow$ VerificationRecord $\rightarrow$ Ed25519 Verifiable Credential $\rightarrow$ Verifier Web** pipeline is **100% functional, fully integrated, securely gated, and empirically verified by 98 passing tests**. Upstream DigiLocker identity verification and Account Aggregator bank data are currently simulated or planned for post-hackathon API registration.
