# CLAUDE.md - OnShift Technical Guide & Developer Instructions

> **OnShift**: Portable Proof of Work & Income for the Gig Workforce  
> **Evaluation Window**: 2–3 Days Hackathon Prototype  
> **Core Philosophy**: **CORE TRUST MECHANISMS ARE NEVER DROPPED. EXTERNAL DEPENDENCIES GET A TECHNICALLY HONEST FALLBACK.**

---

## 1. Quality Hierarchy & Fallback Policy

### TIER 1: MUST BE REAL IMPLEMENTATION (NO MOCKS ALLOWED)
- **Reconciliation Engine**: Real mathematical deduction & shortfall classification (`MATCHED`, `EXPLAINED_DIFFERENCE`, `UNEXPLAINED_DIFFERENCE`, `INSUFFICIENT_EVIDENCE`).
- **Verification Engine**: Real rule-based evidence scoring, conservative confidence, and explainable limitations.
- **Privacy Layer**: Real local-first data separation (Local Data, Derived Data, Shared Data, Credential Claims).
- **Encrypted Storage**: Android Keystore-backed key protection & encrypted local vault.
- **Tamper-Evident Hash Chain**: Real sequential SHA-256 chaining (`verifyHashChain`).
- **Selective Disclosure**: Real claim filtering based on worker checkbox selections.
- **Ed25519 Signing**: Real digital signature math over serialized credential JSON.
- **Independent Verification**: Real client-side Ed25519 signature validation in Verifier Web App without querying backend.

### TIER 2: REAL INTEGRATION STRONGLY PREFERRED
- **Account Aggregator Sandbox**: Investigate and attempt live Setu/Sahamati sandbox flow first.
- **Android NotificationListenerService**: Register service and implement at least one real notification parser (`ZomatoParser` / `SwiggyParser`).
- **Identity Adapter**: DigiLocker/UIDAI adapter architecture resulting in pseudonymous OnShift ID (`OS-DEMO-001`).

### TIER 3: EXTERNAL INTEGRATIONS WITH TECHNICALLY HONEST FALLBACKS
- **AA Fallback**: If sandbox credentials or FI connectivity are unavailable, retain the real `AccountAggregatorProvider` adapter architecture and use `MockAccountAggregatorProvider` as an explicitly labeled fallback. Demo must clearly distinguish sandbox data from mock fallback data.
- **Notification Listener Fallback**: Deterministic notification fixtures may be used as a demo fallback if live physical device notifications cannot be triggered reliably. The downstream evidence/reconciliation pipeline MUST be identical for live and fixture evidence.
- **Government Scheme Catalog**: Deterministic structured scheme dataset evaluating income thresholds and document requirements.

### TIER 4: POLISH (CAN BE DROPPED IF TIME IS SHORT)
- Micro-animations, transition effects, extra charts, additional platform parsers, extra schemes.

---

## 2. Single Source of Truth Rule

> **NO MODULE MAY INVENT ITS OWN INTERPRETATION OF EVIDENCE OR VERIFICATION STATUS.**

- The **Python Verification Engine** is the **SINGLE SOURCE OF TRUTH** for evidence strength, reconciliation status, and verification classification.
- Android UI, Express Backend, and Web Verifier MUST consume `VerificationResult` from the verification engine rather than inventing their own UI checkmarks or local status decisions.

---

## 3. Trust Architecture Conceptual Flow

```
EVIDENCE (Declared, Observed Notification, Financial AA)
   ↓
PROVENANCE & TAMPER-EVIDENT HASH CHAIN (Local SHA-256 Chaining)
   ↓
RECONCILIATION ENGINE (Expected vs Actual Settlement & Shortfalls)
   ↓
VERIFICATION ENGINE (DECLARED → OBSERVED → CORROBORATED → FINANCIALLY_CORROBORATED)
   ↓
PRIVACY LAYER (Local Vault & On-device Separation)
   ↓
SELECTIVE DISCLOSURE (Worker-Controlled Claim Filtering)
   ↓
SIGNED PORTABLE CREDENTIAL (Ed25519 Cryptographic Proof)
   ↓
INDEPENDENT EXTERNAL VERIFIER (Standalone React Web App)
```

---

## 4. Canonical Scenarios

### Scenario 1: MATCHED & FINANCIALLY CORROBORATED
- Expected gross platform earnings: ₹30,500
- Known platform uniform deductions: ₹400
- Expected net settlement: ₹30,100
- Actual bank settlement credit: ₹30,100
- Status: **`MATCHED`**
- Verification Level: **`FINANCIALLY_CORROBORATED`** (Confidence: 0.96)
- Explanation: Expected payout matches actual bank credit exactly after accounting for ₹400 authorized uniform deduction.

### Scenario 2: UNEXPLAINED DIFFERENCE
- Expected payout: ₹30,100
- Actual bank settlement credit: ₹29,500
- Known deductions: ₹0
- Difference / Shortfall: ₹600
- Status: **`UNEXPLAINED_DIFFERENCE`**
- Verification Level: **`CORROBORATED`** (Confidence: 0.72)
- Explanation: Observed platform activity exceeds bank settlement credit by ₹600 with no documented platform deduction record.

---

## 5. Mandatory 20-Second Technical Tampering Demos

### Demo A: Hash Chain Provenance Tamper Detection
1. Present valid hash chain: `verifyHashChain()` returns **`VALID ✓`**.
2. Modify a historical evidence record amount (e.g. ₹2,400 → ₹9,400).
3. Run `verifyHashChain()`: returns **`INVALID ✗`** and identifies `brokenAt` record ID.
4. Pitch Message: *"The system doesn't claim data is impossible to change. It makes post-capture alteration detectable."*

### Demo B: Credential Signature Tamper Detection
1. Paste valid credential JSON into Verifier Web App: returns **`✓ Valid Signature & Issuer`**.
2. Modify verified income number in JSON textarea (e.g. ₹30,100 → ₹50,100).
3. Click Verify: returns **`✗ Verification Failed`**.
4. Pitch Message: *"Credentials cannot be modified by the worker or third parties without invalidating the Ed25519 signature."*

---

## 6. Account Aggregator Checkpoint

Before declaring AA integration complete, verify:
- [ ] AccountAggregatorProvider interface defined.
- [ ] Real sandbox access investigated (Setu/Sahamati).
- [ ] Authentication and consent flow understood.
- [ ] Financial data response schema documented.
- [ ] Sandbox adapter implemented if accessible.
- [ ] Mock adapter conforms to identical interface and schema.
- [ ] Mock fallback is visibly labeled as mock.
- [ ] Reconciliation engine consumes normalized AA data identically.
- [ ] Unavailable AA state handled gracefully.

---

## 7. Government Schemes Engine (Nemotron Ultra 3 AI + Deterministic Fallback)
- **Location**: Backend Engine (`POST /api/v1/schemes/recommend`) & Android Worker Application UI.
- **Structured Filter First**: Evaluates occupation, income thresholds (e.g. ₹29,500), location, and worker category deterministically BEFORE calling LLM.
- **Nemotron Ultra 3 AI Layer**: Takes filtered candidate schemes and generates relevance rankings (`HIGH`, `MEDIUM`, `LOW`), natural-language explanations, and key benefits.
- **Deterministic Fallback**: If Nemotron API key is absent or API is unreachable, the engine falls back smoothly to deterministic ranking (`DETERMINISTIC_FALLBACK`). The feature NEVER fails during a demo.
- **Wording Discipline**: Uses recommendation wording *"You may be a relevant candidate..."* (model explains & ranks, does NOT certify official government eligibility).
- **Architectural Separation**: External Verifier web app and Government Scheme engine are SEPARATE flows. Nemotron is NEVER involved in verifying Ed25519 signature validity.

---

## 8. Technology Stack
- **Android App**: Kotlin, Jetpack Compose, `NotificationListenerService`, Room, Android Keystore / Jetpack Security.
- **Backend API Gateway**: Node.js, Express, TypeScript, MongoDB, Mongoose ODM.
- **Verification Engine**: Python 3, FastAPI, Pydantic, Pytest.
- **Cryptography**: Ed25519 (Node `crypto` & `@onshift/credential-schema`).
- **Verifier Web Portal**: React 18, Vite, TypeScript, Vanilla CSS.
- **Monorepo**: npm workspaces (`@onshift/shared-types`, `@onshift/credential-schema`, `@onshift/mock-data`).

---

## 9. Team Ownership Matrix

- **Member 1 (Sadhana)**: Android Worker UI (`apps/android/.../ui/screens/`)
- **Member 2 (Apoorva)**: Evidence Verification & Financial Reconciliation (`apps/verification-engine/`)
- **Member 3 (Rimjhim)** & **Member 5 (Nidhi)**: Coordinated Workstream:
  - **Rimjhim (M3)**: Express Backend API Gateway & MongoDB (`apps/backend/`)
  - **Nidhi (M5)**: Cryptography, Credential Schema & Account Aggregator Architecture (`packages/credential-schema/`, `apps/android/.../aa/`)
- **Member 4 (Aanya)**: Android Security, Notifications & Vault (`apps/android/.../notifications/`, `vault/`, `hashchain/`)
- **Member 6 (Surbhi)**: AI-Powered Government Scheme Recommendation & Web Integration (`apps/verifier-web/`, `apps/backend/.../schemeController.ts`)

---

## 10. Testing & Build Commands
```bash
# Build all TypeScript workspaces and applications
npm run build

# Run Node backend integration tests
npm --prefix apps/backend test

# Run Python verification engine pytest
cd apps/verification-engine && PYTHONPATH=. python3 -m pytest

# Seed canonical demo data
npm run seed:demo
```
