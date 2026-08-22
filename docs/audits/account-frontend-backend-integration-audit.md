# ON SHIFT — ACCOUNT FRONTEND & BACKEND INTEGRATION AUDIT

**Date**: August 22, 2026  
**Auditor**: Lead Integration Engineer  
**Repository State**: Working Tree (Commit `0d63763`)  
**Functional Verdict**: 🟢 **CONNECTED**  
**Monorepo Test Suite Results**: 🟢 **98 / 98 PASSED**  

---

## 1. Inventory & Identification of Account Frontends

The repository contains two user-facing application clients:
1. **Android Native Worker Account Application** (`apps/android`):
   - Entry Point: `MainActivity.kt`
   - Framework: Kotlin with Jetpack Compose UI.
   - Screen Routes: `PlatformSelection`, `HomeScreen` (Dashboard), `IdentityScreen` (Auth & DigiLocker), `EvidenceScreen`, `VerificationScreen`, `ReconciliationScreen`, `CredentialScreen`, `GovernmentSchemesScreen`, `ProfileScreen`.
   - Data Connection: Integrated with `BackendApiClient.kt` (`http://10.0.2.2:4000/api/v1`) & local AES-256-GCM vault repository.

2. **Web Worker Studio & Verifier Application** (`apps/verifier-web`):
   - Entry Point: `main.tsx` $\rightarrow$ `App.tsx`
   - Framework: Vite + React + TypeScript.
   - Screen Routes: `Worker Studio` (Worker Identity, Evidence Store, Engine Execution, Credential Issuance & Export, Scheme Signals) and `Lender Verifier Console` (Browser-side Ed25519 Credential Verification).
   - Data Connection: Centralized API client `src/api/client.ts` (`http://localhost:4000/api/v1`).

---

## 2. Mapping of Account Frontend Screens to Backend APIs

```
Account Frontend Screen       │ Backend API Endpoint          │ Responsible Controller / Engine
──────────────────────────────┼───────────────────────────────┼────────────────────────────────────────
Worker Session / Auth         │ GET /api/v1/health            │ Express Gateway Router (index.ts)
Worker Profile               │ GET /api/v1/workers/:id       │ workerController.ts
Ingested Evidence List        │ GET /api/v1/evidence/worker/:id│ evidenceController.ts
Submit Evidence               │ POST /api/v1/evidence         │ evidenceController.ts
Run Verification              │ POST /api/v1/verification/run │ verificationController.ts & Python Engine
Run Reconciliation            │ POST /api/v1/reconciliation/run│ reconciliationController.ts & Python Engine
Issue Credential ({verifId})  │ POST /api/v1/credentials/issue│ credentialController.ts & Ed25519 Signer
Verify Credential             │ POST /api/v1/credentials/verify│ credentialController.ts / WebCrypto
Government Scheme Signals     │ POST /api/v1/schemes/recommend│ schemeController.ts
```

---

## 3. Integration Phase Audit Findings

### Phase 1 — Authentication & Identity
- Connected account sessions to backend JWT token authentication system (`authMiddleware.ts`).
- Requests attach `Authorization: Bearer <token>` and `x-worker-id`.
- Worker identity is derived from the authenticated session (`req.user.workerId`); arbitrary client-supplied worker IDs are checked and rejected with `403 Forbidden` (`WORKER_ID_MISMATCH`) if an identity mismatch occurs.

### Phase 2 — Evidence Management
- Frontend consumes real evidence from `GET /api/v1/evidence/worker/:workerId`.
- Displays evidence source (`OBSERVED`/`DECLARED`/`FINANCIAL`), platform, role, category, amount, currency, timestamp, and sync status (`SYNCED`).
- Raw notification body text is stripped and privacy-minimized.

### Phase 3 — Authoritative Server Verification Execution
- Action: **Run Authoritative Verification** invokes `POST /api/v1/verification/run`.
- Client does **NOT** dictate `verificationLevel` or income claims.
- Python Verification Engine deterministically processes evidence and calculates reconciliation metrics.
- Renders authoritative response: `verificationId`, `level`, `reconciliationStatus`, `expectedGross`, `authorizedDeductions`, `expectedNet`, `actualSettlement`, and `verificationEngineVersion`.

### Phase 4 — Reconciliation UI
- Displays relationship between Observed Earnings, Expected Net Income, Actual Bank Settlement, and Reconciliation Status (`MATCHED`, `EXPLAINED_DIFFERENCE`, `UNEXPLAINED_DIFFERENCE`, `INSUFFICIENT_EVIDENCE`).
- UI does **NOT** calculate a stronger verification tier than the server.

### Phase 5 — Credential Issuance & Display
- Action: **Issue Signed Verifiable Credential** invokes `POST /api/v1/credentials/issue` sending **ONLY** `{ verificationId: "..." }`.
- Server derives claims from immutable `VerificationRecord` snapshot and signs with Ed25519.
- Displays signed W3C Verifiable Credential JSON with copy and direct transfer capabilities to the Verifier Portal.
- Issuance is idempotent for the same `verificationId`.

### Phase 6 — Government Schemes
- Connects to `POST /api/v1/schemes/recommend` passing verified monthly income and profile parameters.
- Displays eligible schemes (`PM-SVANidhi`, `e-Shram`, `Ayushman Bharat`) with match reasons and AI engine source badge (`DETERMINISTIC_FALLBACK` / `NEMOTRON_ULTRA_3`).

### Phase 7 — DigiLocker / Identity Status
- Explicitly labeled with an honest badge: `Sandbox / Identity Verification Pending (API Setu Key Required)`.
- Does **NOT** fabricate successful DigiLocker verification.

---

## 4. Complete Monorepo Test Execution Results

```bash
# 1. Web Application Build (apps/verifier-web)
$ npm run build
Output: tsc (Clean build, 0 errors)

# 2. Express Backend Test Suite (apps/backend)
$ npm run build && npm run test
PASS tests/api.test.ts
PASS tests/integration.test.ts
PASS tests/pipeline.test.ts
Test Suites: 3 passed, 3 total
Tests:       43 passed, 43 total

# 3. Python Verification Engine Pytest (apps/verification-engine)
$ cd apps/verification-engine && PYTHONPATH=. python3 -m pytest -vv
======================== 36 passed, 1 warning in 0.32s =========================

# 4. Android Unit Suite (apps/android)
$ cd apps/android && ./run_unit_tests.sh
OK (19 tests)
```

- **Total System Test Execution**: **98 / 98 PASSED** (0 Failures across all monorepo tiers).

---

## 5. Security & Boundary Acceptance Checklist

- **No Token / Invalid Token**: Protected routes return `401 Unauthorized`.
- **Cross-Worker Data Access**: Accessing or verifying another worker's evidence returns `403 Forbidden`.
- **Cross-Worker Credential Issuance**: Issuing a credential using another worker's `verificationId` returns `403 Forbidden`.
- **Level Forgery Prevention**: Client cannot dictate verification level or expected income.
- **Credential Claim Forgery Prevention**: Claims are constructed server-side inside `handleIssueCredential`.
- **Idempotency**: Repeated credential issuance returns the existing signed VC.

---

## 6. Final Readiness Verdict

🟢 **CONNECTED & OPERATIONAL**  
The account frontend clients (`apps/verifier-web` and `apps/android`) are connected to the Express backend API Gateway and Python Verification Engine. All 98 monorepo automated tests pass cleanly.
