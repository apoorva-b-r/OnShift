# OnShift

> **Tagline**: Portable Proof of Work & Income for the Gig Workforce

OnShift is a worker-owned application that turns fragmented gig-work activity and financial evidence into a portable, evidence-based income record.

---

## 1. Problem Statement

Gig workers in India (delivery partners, rideshare drivers, task workers) face systemic financial exclusion. Despite working long hours across multiple platforms (Zomato, Swiggy, Uber), their income data remains trapped in siloed platform dashboards. Traditional banks, landlords, and government benefit schemes require formal salary slips or multi-year tax returns. Because gig workers lack formal proof of income, they are forced to rely on high-interest predatory loans or remain excluded from social security benefits.

---

## 2. The OnShift Solution

OnShift provides a worker-controlled, evidence-based privacy layer that aggregates fragmented gig activity into cryptographically signed portable credentials.

Key Principles:
- **No Backend Platform APIs Required**: Captures platform order and payout notifications directly on-device via Android `NotificationListenerService`.
- **Local-First & Pseudonymous**: Raw financial records and notification logs stay in the worker's encrypted local vault.
- **Evidence-Based Reconciliation**: Reconciles self-declared claims, observed notifications, and financial bank settlements.
- **Explainable Verification Levels**: Computes transparent verification levels (`DECLARED` → `OBSERVED` → `CORROBORATED` → `FINANCIALLY_CORROBORATED`).
- **Selective Disclosure**: Workers choose exactly which claims to export into signed Ed25519 credentials.

---

## 3. Core Technical Concept

```
EVIDENCE → PROVENANCE → RECONCILIATION → VERIFICATION → PORTABLE PROOF
```

System Conceptual Flow:

```
IDENTITY (Pseudonymous Worker ID)
    ↓
EVIDENCE COLLECTION (Declared, Observed, Financial AA)
    ↓
RECONCILIATION ENGINE (Explainable Deductions & Settlement Matching)
    ↓
VERIFICATION PIPELINE (Rule-based Confidence & Verification Levels)
    ↓
PRIVACY LAYER & SELECTIVE DISCLOSURE (Worker-Controlled Attributes)
    ↓
SIGNED PORTABLE CREDENTIAL (Ed25519 Digital Signatures)
    ↓
EXTERNAL VERIFIER PORTAL (React Web) & GOVERNMENT SCHEME MATCHING
```

---

## 4. Implementation Status Matrix

| Component / Feature | Status | Notes |
|---|---|---|
| Shared Type Contracts & Credential Schema | **IMPLEMENTED** | `@onshift/shared-types` & `@onshift/credential-schema` |
| Ed25519 Signature Generation & Verification | **IMPLEMENTED** | Standard crypto Ed25519 signing and verification |
| Python Reconciliation Engine (`apps/verification-engine`) | **IMPLEMENTED** | Rule-based explainable reconciliation statuses |
| Python Verification Pipeline | **IMPLEMENTED** | Deterministic levels and confidence scores |
| Node.js Express Gateway (`apps/backend`) | **IMPLEMENTED** | Full REST API routes for all modules |
| React Verifier Portal (`apps/verifier-web`) | **IMPLEMENTED** | Paste/verify credentials & render disclosed claims |
| Android Scaffolding (`apps/android`) | **IMPLEMENTED** | Kotlin Jetpack Compose screens, NotificationListenerService, Vault, Hash Chain |
| Local Tamper-Evident SHA-256 Hash Chain | **IMPLEMENTED** | Local provenance & tamper detection (`verifyHashChain`) |
| Account Aggregator Consent Flow | **MOCKED** | Mock sandbox flow via `MockAccountAggregatorProvider` |
| Platform Notification Parsers | **MOCKED** | Heuristic parsers for Zomato, Swiggy, Uber notification formats |
| Government Scheme Engine | **IMPLEMENTED** | Deterministic matching against mock scheme dataset |
| Live Production Banking / AA API | **PLANNED** | Integration adapter boundaries established for Sahamati/Setu |

---

## 5. Technology Stack

- **Android Client**: Kotlin, Jetpack Compose, NotificationListenerService, Room, Android Keystore, SHA-256 Hashing.
- **Backend API**: Node.js, Express.js, TypeScript, MongoDB, Mongoose ODM.
- **Verification Engine**: Python 3, FastAPI, Pydantic, Pytest.
- **Cryptography**: Ed25519 (Node `crypto` and `cryptography` library).
- **Web Verifier**: React 18, TypeScript, Vite, CSS design system.
- **Monorepo**: npm workspaces.

---

## 6. Monorepo Structure

```
OnShift/
├── README.md
├── .gitignore
├── .env.example
├── docker-compose.yml
├── package.json
├── docs/
│   ├── architecture.md
│   ├── api-contract.md
│   ├── data-model.md
│   ├── demo-flow.md
│   ├── security.md
│   └── team-ownership.md
├── apps/
│   ├── android/             # Kotlin Jetpack Compose App & Notification Listener
│   ├── backend/             # Node.js Express REST API Gateway
│   ├── verification-engine/ # Python FastAPI Reconciliation & Verification Engine
│   └── verifier-web/        # React Web Portal for External Verifiers
├── packages/
│   ├── shared-types/        # Domain TypeScript definitions
│   ├── credential-schema/   # Ed25519 signing/verification helpers
│   └── mock-data/           # Canonical demo datasets for Ravi Kumar
└── scripts/
    ├── seed-demo-data.js
    ├── start-dev.js
    └── reset-demo.js
```

---

## 7. Local Setup & Quickstart

### Prerequisites
- Node.js >= 18
- Python >= 3.10
- Java JDK >= 17 (for Android build)

### Step 1: Install Workspace Dependencies
```bash
npm install
```

### Step 2: Build Shared Packages
```bash
npm run build
```

### Step 3: Run Test Suite
```bash
# Test shared packages & backend
npm run test

# Test Python verification engine
npm run test:engine
```

### Step 4: Seed Demo Data
```bash
npm run seed:demo
```

### Step 5: Start Local Development Services
```bash
# Start backend API (port 4000) and Web Verifier (port 3000)
npm run start:dev

# In a separate terminal, start Python Verification Engine (port 8000)
npm run dev:engine
```

---

## 8. Docker Deployment

To launch MongoDB, Node Backend, Python Verification Engine, and React Verifier in Docker:
```bash
docker-compose up --build
```

---

## 9. Team Ownership Matrix

- **Member 1 (Sadhana)**: Frontend & UI (`apps/android/.../ui/`)
- **Member 2 (Apoorva)**: FinTech & Verification Engine (`apps/verification-engine/`)
- **Member 3**: Backend Development (`apps/backend/`)
- **Member 4 (Aanya)**: Android & Security (`apps/android/.../notifications/`, `vault/`, `hashchain/`)
- **Member 5**: Cryptography & Financials (`packages/credential-schema/`, `apps/android/.../aa/`)
- **Member 6 (Surbhi)**: Web & Scheme Matching (`apps/verifier-web/`)

See [`docs/team-ownership.md`](file:///Users/Apoorva/Documents/hackathons/OnShift/docs/team-ownership.md) for full breakdown.

---

## 10. Security & Limitations

- **Tamper Detection**: OnShift uses sequential SHA-256 hash chaining to detect local data modifications (`verifyHashChain`). This is tamper detection, not blockchain.
- **Privacy First**: Raw notifications and transactions remain on the worker's device. Credentials use Ed25519 digital signatures with selective disclosure.
- **Hackathon Sandbox**: Account Aggregator integration uses mock transaction payloads for development.
