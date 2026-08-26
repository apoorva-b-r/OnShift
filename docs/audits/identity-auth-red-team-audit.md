# ON SHIFT — IDENTITY & AUTHENTICATION RED-TEAM ARCHITECTURE AUDIT

**Date**: August 22, 2026  
**Auditor**: Lead Security Architect, OAuth/OIDC Specialist & Adversarial Penetration Tester  
**Repository State**: Commit `a628499` / Active Working Tree  
**Overall Red-Team Verdict**: 🔴 **FUNDAMENTALLY UNSAFE (FOR PRODUCTION) / 🟡 SAFE WITH FIXES (FOR HACKATHON DEMO)**  

---

## 1. Executive Summary

This document presents a brutal, line-by-line adversarial red-team audit of OnShift's authentication, identity-verification, and authorization architecture. Rather than assuming design documents or intended specifications reflect working code, this audit reconstructed the **actual system reality** by inspecting Express routes, Mongoose schemas, Android Kotlin packages, Python Verification Engine code, and test suites.

### The Truth Right Now
1. **DigiLocker / Setu Identity Integration**: **NOT IMPLEMENTED IN CODE**. The repository contains zero OAuth 2.0 flow, zero API Setu integration code, zero DigiLocker token handlers, and zero `SetuIdentityProvider` classes. DigiLocker identity verification exists only as UI strings in Android (`strings.xml`).
2. **API Authentication & Authorization**: **COMPLETELY MISSING**. Express backend API routes (`routes/index.ts`) accept `workerId` directly from HTTP request bodies or path parameters without JWT, session cookie, or bearer token validation.
3. **IDOR / Account Takeover / Evidence Spoofing**: **TRIVIALLY EXPLOITABLE TODAY**. Any unauthenticated HTTP client can read, submit, or trigger verification/credential issuance for any `workerId` (e.g., `workerId: "OS-DEMO-001"` or `"victim"`).

---

## 2. Intended Architecture vs. Real Repository Implementation

```
                     INTENDED SECURITY ARCHITECTURE
┌──────────────────────────────────────────────────────────────────────────┐
│ Android App / Verifier UI ──(Bearer JWT)──> OnShift Express Backend     │
│                                                     │                    │
│                                                     ▼                    │
│                                          Setu Identity Provider          │
│                                                     │                    │
│                                                     ▼                    │
│                                           API Setu / DigiLocker          │
└──────────────────────────────────────────────────────────────────────────┘

                      REAL REPOSITORY IMPLEMENTATION
┌──────────────────────────────────────────────────────────────────────────┐
│  Any HTTP Client ──(Unauthenticated POST /evidence)──> Express Backend   │
│         │                                                    │           │
│         │ (Sends workerId: "victim" in JSON body)            ▼           │
│         └───────────────────────────────────────> MongoDB (Evidence)     │
│                                                                          │
│  [DigiLocker / Setu Identity Provider] = NOT IMPLEMENTED IN CODEBASE     │
│  [JWT / Bearer Session Middleware]     = NOT IMPLEMENTED IN CODEBASE     │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Audit Sections

### 3.1 OAuth / Setu / DigiLocker Flow Audit
- **Authorization Code Flow**: **NOT IMPLEMENTED**.
- **State Generation & CSRF Protection**: **NOT IMPLEMENTED**.
- **Token Exchange & PKCE**: **NOT IMPLEMENTED**.
- **Assessment**: There are no Setu client credentials, secrets, or redirect URIs in `apps/backend/src`. The backend currently has `ConsentRequest.ts` for Account Aggregator (AA) financial consent tracking, but zero code for DigiLocker identity OAuth.

### 3.2 Identity Binding Audit
- **Worker Mapping**: `Worker.ts` model contains `id`, `name`, `workerCategory`, and `location`. It contains **no identity link fields** (e.g., `digilockerId`, `aadhaarHash`, `setuSubject`).
- **Identity Substitution Attack**: An attacker can invoke `POST /workers` with `id: "victim"` or submit evidence under `workerId: "victim"`. Because there is no token validation linking the socket connection to a verified worker session, identity binding is completely absent.

### 3.3 JWT & Session Security Audit
- **Status**: **NOT IMPLEMENTED**.
- **Findings**: `grep -i jwt` across the codebase yields 0 results in executable backend code.
- **Session Vulnerabilities**:
  - No session cookies, no refresh token rotation, no token revocation.
  - Endpoint trust relies entirely on user-supplied `workerId` strings in HTTP bodies.

### 3.4 Authorization & IDOR (Insecure Direct Object References)
- **Vulnerability**: Every endpoint in `routes/index.ts` is an open IDOR vector:
  - `GET /evidence/worker/:workerId`: Returns all evidence for any worker ID without authentication.
  - `POST /evidence`: Accepts `{ workerId: "victim", ... }` and persists false evidence to MongoDB under the victim's account.
  - `POST /reconciliation/run`: Runs financial reconciliation for any worker ID.
  - `POST /verification/level`: Computes verification level for any worker ID.
  - `POST /credentials/issue`: Issues a signed W3C Verifiable Credential for any worker ID.

### 3.5 Identity $\rightarrow$ Evidence $\rightarrow$ Verification Binding
- **Logical Binding**: The Python Verification Engine (`verification.py` & `reconciliation.py`) correctly enforces mathematical invariants on whatever evidence records are passed to it.
- **Pipeline Vulnerability**: Because the backend allows unauthenticated evidence injection (`POST /evidence`), an attacker can submit notification evidence for Worker A, bank settlement evidence for Worker B, and trigger `POST /credentials/issue` for Worker C. The engine will evaluate the submitted records deterministically, but the backend allows arbitrary worker ID attribution prior to engine execution.

### 3.6 Secrets & Credential Leakage Audit
- **Setu Secrets**: Not present in frontend or Android APK (no Setu integration code exists).
- **Signing Keys**: Backend uses Ed25519 private key configured via environment variable (`config.ed25519PrivateKeyHex`). The key is properly kept on the server side and used in `@onshift/credential-schema` to sign credentials.

---

## 4. Threat Model & Vulnerability Matrix

| Threat ID | Threat Vector | Vulnerable Component | Exploitability | Impact | Current Defense | Status |
| :--- | :--- | :--- | :---: | :---: | :--- | :---: |
| **T1** | Unauthenticated Evidence Injection | `POST /evidence` | **TRIVIAL** | 🔴 **CRITICAL** | None (No Auth Middleware) | **VULNERABLE** |
| **T2** | Worker ID Spoofing / Identity Hijacking | `POST /credentials/issue` | **TRIVIAL** | 🔴 **CRITICAL** | None (User passes `workerId`) | **VULNERABLE** |
| **T3** | Cross-Worker Evidence Exfiltration | `GET /evidence/worker/:id` | **TRIVIAL** | 🟠 **HIGH** | None (Open GET Endpoint) | **VULNERABLE** |
| **T4** | DigiLocker Identity Bypass | DigiLocker UI Button | N/A | 🟡 **MEDIUM** | Frontend string only (No backend API) | **MOCKED/PLANNED** |
| **T5** | Fake Financial Settlement Ingestion | `POST /evidence` (source=FINANCIAL) | **TRIVIAL** | 🟠 **HIGH** | `is_attributable_settlement()` in Python engine | **PARRY / MITIGATED IN ENGINE** |

---

## 5. Exploit Scenarios (Proof-of-Concept)

### Exploit 1: Unauthenticated Credential Generation for Victim Worker
```bash
# Attacker executes HTTP request to issue signed credential for arbitrary workerId "OS-VICTIM-999"
curl -X POST http://localhost:3001/api/v1/credentials/issue \
  -H "Content-Type: application/json" \
  -d '{
    "workerId": "OS-VICTIM-999",
    "disclosedClaims": {
      "verifiedIncome": 50000,
      "period": "01 Aug to 07 Aug 2026",
      "verificationLevel": "FINANCIALLY_CORROBORATED"
    }
  }'
```
**Outcome**: Express backend signs and persists an official `OnShiftIncomeCredential` for `OS-VICTIM-999` with Ed25519 signature without verifying if the caller owns or is authenticated as `OS-VICTIM-999`.

---

## 6. Recommended Actionable Fixes (P0–P2)

### P0 (Critical - Must Fix Before Hackathon Evaluation)
1. **Implement Lightweight JWT / Secret Authentication Middleware (`authMiddleware.ts`)**:
   - Create simple HMAC-SHA256 JWT signing/verification in Express backend.
   - Require `Authorization: Bearer <token>` header on all `/api/v1/evidence` and `/api/v1/credentials` endpoints.
   - Extract `req.user.workerId` from verified token payload rather than trusting `req.body.workerId`.

### P1 (High - Required for Real DigiLocker Identity Flow)
1. **Implement Setu OAuth 2.0 PKCE Authorization Endpoint (`/api/v1/auth/digilocker`)**:
   - Store Setu `client_id` and `client_secret` in backend `.env`.
   - Implement `state` token generation with single-use Redis/Memory expiry.
   - Exchange `auth_code` server-side and bind `digilockerId` to `Worker` MongoDB model.

### P2 (Medium - Audit & Security Hardening)
1. **Server-Side Hash Chain Validation**:
   - Validate client-submitted evidence hash chains against existing database chain states during sync to reject re-generated local databases.

---

## 7. What is Safe to Claim vs. What MUST NOT be Claimed

### 🟢 SAFE TO CLAIM TO JUDGES:
1. "The Verification Engine deterministically reconciles evidence and enforces 4 strict verification tiers."
2. "Android notification evidence is encrypted at rest using AES-256-GCM and linked with SHA-256 hash chains."
3. "Issued credentials are cryptographically signed using Ed25519."

### ⚠️ MUST NOT CLAIM TO JUDGES:
1. *Do NOT claim that DigiLocker / API Setu identity OAuth is live in the current codebase* (It is currently simulated/planned).
2. *Do NOT claim that Express API endpoints enforce JWT bearer token authentication* (Routes currently accept `workerId` directly).

---

## 8. Final Blunt Verdict

**Final Verdict**: 🔴 **FUNDAMENTALLY UNSAFE (FOR PRODUCTION) / 🟡 SAFE WITH FIXES (FOR HACKATHON DEMO)**

While the underlying cryptography (Ed25519, AES-256-GCM, SHA-256) and Python Verification Engine rules are 100% functional and tested (88 passing tests), the Express backend lacks route authentication and identity token binding, making IDOR and worker spoofing trivial for any raw HTTP client. Adding `authMiddleware.ts` to enforce token-based worker authorization will immediately elevate the project to **🟢 SAFE FOR DEMO**.
