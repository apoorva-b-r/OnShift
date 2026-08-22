# ON SHIFT — ANDROID ACCOUNT FRONTEND & BACKEND INTEGRATION AUDIT

**Date**: August 22, 2026  
**Auditor**: Lead Android & Monorepo Integration Engineer  
**Repository State**: Working Tree (Commit `0d63763`)  
**Functional Verdict**: 🟢 **CONNECTED**  
**Security Verdict**: 🟢 **PASS**  
**Monorepo Test Suite Results**: 🟢 **104 / 104 PASSED** (Android: 25, Express Backend: 43, Python Engine: 36)  

---

## 1. Executive Summary

This document audits the integration of the **Android Native Account Frontend Application** (`apps/android`) against the **Express Backend API Gateway** (`apps/backend`) and the **Python Verification Engine** (`apps/verification-engine`).

The Android frontend communicates with the Express backend via `BackendApiClient.kt` (`http://10.0.2.2:4000/api/v1` for Android emulator / `http://localhost:4000/api/v1` for local network testing). All Compose UI screens consume authoritative backend API contracts with clean state handling (`Loading`, `Success`, `Error`, `Empty`). Local encrypted evidence persistence (`EncryptedEvidenceStore.kt` & `LocalEncryptedEvidenceRepository.kt`) remains intact and handles offline retries safely.

```
+-----------------------------------------------------------------------------------+
|                        ANDROID ACCOUNT FRONTEND (apps/android)                    |
|                        - Jetpack Compose UI Screens                               |
|                        - Local Encrypted Evidence Vault (AES-256-GCM)             |
|                        - SHA-256 Hash Chain Integrity Verification                |
+--------------------------------────────┬────────────────--------------------------+
                                         │
                                         ▼ HTTP REST (BackendApiClient.kt)
+-----------------------------------------------------------------------------------+
|               Express API Gateway (apps/backend/src/routes/index.ts)              |
|               - JWT Auth Middleware: authMiddleware.ts                            |
|               - Evidence Controller: evidenceController.ts                        |
|               - Verification Controller: verificationController.ts                |
|               - Credential Controller: credentialController.ts                    |
|               - Scheme Controller: schemeController.ts                            |
+----------------------------------------┬────────────────--------------------------+
                                         │ REST Call (evidenceAdapter.ts)
                                         ▼
+-----------------------------------------------------------------------------------+
|               Python Verification Engine (apps/verification-engine)              |
|               - FastAPI Endpoints: /verification/level & /reconciliation/run      |
+-----------------------------------------------------------------------------------+
```

---

## 2. Audited Android Screens & API Endpoint Mapping

| Compose UI Screen | File Path | Backend API Endpoint | Data Source & Controller | Handled UI States |
| :--- | :--- | :--- | :--- | :--- |
| **HomeScreen** | `ui/screens/HomeScreen.kt` | `GET /api/v1/health` & `/workers/:id` | Express `index.ts` & `workerController.ts` | `Loading`, `Error`, `Empty`, `Success` |
| **IdentityScreen** | `ui/screens/IdentityScreen.kt` | JWT Auth Session | `authMiddleware.ts` | `Loading`, `Error`, `Success` |
| **EvidenceScreen** | `ui/screens/EvidenceScreen.kt` | `GET /api/v1/evidence/worker/:id` | `evidenceController.ts` & Vault Repo | `Loading`, `Error`, `Empty`, `Success` |
| **VerificationScreen**| `ui/screens/VerificationScreen.kt` | `POST /api/v1/verification/run` | `verificationController.ts` & Python | `Loading`, `Error`, `Empty`, `Success` |
| **ReconciliationScreen**| `ui/screens/ReconciliationScreen.kt` | `POST /api/v1/reconciliation/run` | `reconciliationController.ts` & Python | `Loading`, `Error`, `Empty`, `Success` |
| **CredentialScreen** | `ui/screens/CredentialScreen.kt` | `POST /api/v1/credentials/issue` | `credentialController.ts` & Ed25519 Signer | `Loading`, `Error`, `Empty`, `Success` |
| **SchemesScreen** | `ui/screens/GovernmentSchemesScreen.kt` | `POST /api/v1/schemes/recommend` | `schemeController.ts` | `Loading`, `Error`, `Empty`, `Success` |

---

## 3. Complete Runtime Data Flow Audit

### 3.1 Authenticated Session & Worker Identity
- `BackendApiClient.kt` sets worker session and attaches `Authorization: Bearer <token>` and `x-worker-id` headers.
- Backend `authMiddleware.ts` verifies token signature and extracts `req.user = { workerId }`.
- If client supplies mismatched `workerId`, backend rejects with `403 Forbidden` (`WORKER_ID_MISMATCH`).

### 3.2 Evidence Collection, Encrypted Storage & Offline Sync
- **Local Persistence**: Evidence records are encrypted on disk via `EncryptedEvidenceStore.kt` (`AES/GCM/NoPadding`).
- **Hash Chain**: `HashChain.kt` verifies SHA-256 integrity linking from `GENESIS_HASH`.
- **Sync State Machine**: Unsynced records transition from `UNSYNCED` $\rightarrow$ `SYNCING` $\rightarrow$ `SYNCED`.
- **Process Death Survival**: Unsynced records persist in encrypted storage across app restarts and retries upon network availability.
- **Privacy Minimization**: Notification text is parsed in memory and **never saved to disk or transmitted to backend**.

### 3.3 Authoritative Server Verification Execution
- Action in Android `VerificationScreen` calls `BackendApiClient.runVerification(workerId, evidenceIds)`.
- Request sends **only** `workerId`, `payoutPeriod`, and `evidenceIds`. Client does **not** send `verificationLevel` or income claims.
- Express retrieves worker-owned evidence from MongoDB, adapts schema via `evidenceAdapter.ts`, and calls Python FastAPI engine.
- Returns immutable `VerificationRecord` containing:
  - `verificationId`
  - `level` (`FINANCIALLY_CORROBORATED` / `CORROBORATED` / `OBSERVED` / `DECLARED`)
  - `reconciliationStatus` (`MATCHED` / `UNEXPLAINED_DIFFERENCE` / `EXPLAINED_DIFFERENCE`)
  - `expectedGross`, `authorizedDeductions`, `expectedNet`, `actualSettlement`, `verificationEngineVersion: "1.0.0"`.

### 3.4 Credential Issuance & Idempotency
- Action in Android `CredentialScreen` calls `BackendApiClient.issueCredential(verificationId)`.
- Request sends **ONLY** `{ verificationId: "..." }`.
- Backend checks caller ownership (`record.workerId === req.user.workerId`), constructs claims server-side, signs with Ed25519, and returns signed W3C credential.
- Repeated calls for the same `verificationId` return the identical signed credential (idempotent).

---

## 4. Security & Boundary Verification Matrix

| Security Requirement | Status | Audit Verification |
| :--- | :---: | :--- |
| **Worker identity from JWT** | 🟢 **PASS** | `authMiddleware.ts` extracts identity from token signature. |
| **IDOR cross-worker protection** | 🟢 **PASS** | Referencing another worker's evidence/verification returns 403. |
| **No client-controlled verification level** | 🟢 **PASS** | `POST /verification/run` computes level via Python engine. |
| **No client-controlled credential claims** | 🟢 **PASS** | `POST /credentials/issue` reads claims from `VerificationRecord`. |
| **No fake fallback on API error** | 🟢 **PASS** | Network errors return clean error callbacks without fake data. |
| **Unsynced evidence process restart survival** | 🟢 **PASS** | Verified by `test03_LocalEncryptedEvidencePersistenceAndProcessRestart`. |
| **Hash-chain integrity reload verification** | 🟢 **PASS** | Vault integrity checks pass after reload & sync. |

---

## 5. Complete Monorepo Test Results (104 / 104 PASSED)

```bash
# 1. Android Test Suite (apps/android)
$ ./run_unit_tests.sh
Compiling Kotlin sources...
Running JUnit tests...
OK (25 tests)

# 2. Express Backend Test Suite (apps/backend)
$ npm run build && npm run test
PASS tests/api.test.ts
PASS tests/integration.test.ts
PASS tests/pipeline.test.ts
Test Suites: 3 passed, 3 total
Tests:       43 passed, 43 total

# 3. Python Verification Engine Pytest (apps/verification-engine)
$ cd apps/verification-engine && PYTHONPATH=. python3 -m pytest -vv
======================== 36 passed, 1 warning in 0.33s =========================

# 4. Web Application Build (apps/verifier-web)
$ npm run build
Output: tsc (Clean build, 0 errors)
```

- **Total System Test Count**: **104 / 104 PASSED** (0 Failures across all monorepo tiers).

---

## 6. Final Readiness Verdict

🟢 **CONNECTED & OPERATIONAL**  
The Android Native Account Frontend (`apps/android`) is connected to the Express Backend Gateway and Python Verification Engine via `BackendApiClient.kt`. All 104 monorepo automated tests execute cleanly.
