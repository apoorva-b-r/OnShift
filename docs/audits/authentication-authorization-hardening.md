# P0 Authentication & Authorization Hardening Audit Report

**Date**: 2026-08-26  
**Target Repository**: OnShift Monorepo (`apps/backend`)  
**Status**: Completed  
**Final Verdict**: PASS  

---

## 1. Existing Authentication Architecture
Before hardening, the OnShift Express backend accepted caller-controlled `workerId` fields in request bodies, URL path parameters, or headers without validating identity against a cryptographic token. In development mode, missing headers fell back to unverified client inputs. 

With P0 Hardening, Express backend authentication is enforced via HMAC-SHA256 JWT tokens passed in the `Authorization: Bearer <JWT>` header. The authenticated worker identity is derived strictly from the verified JWT `sub` claim.

---

## 2. Existing MongoDB Storage Architecture
The backend uses MongoDB (configured via `MONGODB_URI` environment variable, default `mongodb://localhost:27017/onshift_db`) with Mongoose models:

| Mongoose Model | Collection Name | Ownership Field |
| :--- | :--- | :--- |
| `Worker` | `workers` | `id` |
| `Evidence` | `evidences` | `workerId` |
| `VerificationRecord` | `verificationrecords` | `workerId` |
| `Credential` | `credentials` | `workerId` |
| `IdentityVerification` | `identityverifications` | `workerId` |
| `ConsentRequest` | `consentrequests` | `workerId` |

No authentication tokens or secrets are stored in MongoDB collections.

---

## 3. JWT Design and Signing Algorithm
- **Signing Algorithm**: Explicitly locked to `HS256` (HMAC-SHA256).
- **Header Check**:
  ```json
  {
    "alg": "HS256",
    "typ": "JWT"
  }
  ```
- **Algorithm Enforcement**: Tokens with `alg: none`, unsupported algorithms (e.g. `RS256`), or missing algorithm headers are rejected with HTTP 401 (`INVALID_TOKEN`).
- **Secret Key Management**: Key loaded from environment configuration (`config.jwtSecret`). Hardcoded secret fallbacks in source code are disabled in production.
- **Payload Shape**:
  ```json
  {
    "sub": "OS-WORKER-123",
    "workerId": "OS-WORKER-123",
    "role": "WORKER",
    "iat": 1787660000,
    "exp": 1787746400
  }
  ```

---

## 4. Strict Worker Identity Derivation from JWT `sub`
- Worker identity is derived exclusively from `payload.sub`.
- The `payload.sub` claim must be a non-empty string.
- `req.user` is augmented as `{ workerId: payload.sub, role: payload.role }`.
- In generic middleware, request bodies are not mutated. If any explicit caller-supplied `workerId` (`req.body.workerId`, `req.params.workerId`, `req.query.workerId`) does not match `req.user.workerId`, the request is rejected immediately with `403 WORKER_ID_MISMATCH`.
- `req.params.id` is not treated as a worker ID in generic middleware to prevent false positives when accessing resource IDs.

---

## 5. Role Authorization Model
- The system enforces role authorization via `requireRole('WORKER')` middleware.
- Valid tokens must contain `role: "WORKER"`. Missing or invalid role claims result in `401 INVALID_TOKEN`.

---

## 6. Protected Routes
The route boundary (`apps/backend/src/routes/index.ts`) mounts `authenticateWorker` and `requireRole('WORKER')` across all worker-sensitive endpoints:

| Endpoint | Method | Protection Level | Ownership Scope |
| :--- | :--- | :--- | :--- |
| `/api/v1/health` | GET | Public | None |
| `/api/v1/workers/:id` | GET | Protected | `req.params.id === req.user.workerId` |
| `/api/v1/workers` | POST | Protected | `req.user.workerId` |
| `/api/v1/evidence/worker/:workerId` | GET | Protected | `req.params.workerId === req.user.workerId` |
| `/api/v1/evidence` | POST | Protected | `req.user.workerId` |
| `/api/v1/reconciliation/run` | POST | Protected | `req.user.workerId` |
| `/api/v1/verification/level` | POST | Protected | `req.user.workerId` |
| `/api/v1/verification/run` | POST | Protected | `req.user.workerId` |
| `/api/v1/credentials/issue` | POST | Protected | `req.user.workerId` |
| `/api/v1/credentials/verify` | POST | Public | Bare signature verification |
| `/api/v1/consent/request` | POST | Protected | `req.user.workerId` |
| `/api/v1/consent/status/:consentId` | GET | Protected | `{ consentId, workerId: req.user.workerId }` |
| `/api/v1/identity/digilocker/initiate` | POST | Protected | `req.user.workerId` |
| `/api/v1/identity/digilocker/status` | GET | Protected | `req.user.workerId` |
| `/api/v1/identity/digilocker/verify` | POST | Protected | `req.user.workerId` |
| `/api/v1/identity/digilocker/callback` | GET | Public | OAuth callback |
| `/api/v1/schemes*` | GET/POST | Public | General policy matching |

---

## 7. Worker-ID and Resource-ID Ownership Protections
- **Worker ID Mismatch**: Any attempt by Worker A to query or mutate Worker B's worker ID via body, URL parameter, or query string triggers an immediate HTTP 403 `WORKER_ID_MISMATCH`.
- **Resource ID Guesses**: Queries for resource IDs (`verificationId`, `consentId`, `evidenceIds`) enforce `{ resourceId, workerId: req.user.workerId }`. Attempting to access another worker's resource ID returns HTTP 403 (`FORBIDDEN_WORKER_MISMATCH` / `FORBIDDEN_EVIDENCE_ACCESS` / `FORBIDDEN_CONSENT_ACCESS`) or HTTP 404.

---

## 8. MongoDB Ownership Scoping for Each Relevant Collection
Every document creation and query includes the verified worker ID:
- `Evidence.create({ ...doc, workerId: req.user.workerId })`
- `VerificationRecord.create({ ...doc, workerId: req.user.workerId })`
- `Credential.create({ ...doc, workerId: req.user.workerId })`
- `ConsentRequest.create({ ...doc, workerId: req.user.workerId })`
- `IdentityVerification.findOne({ workerId: req.user.workerId })`
- `Worker.findOne({ id: req.user.workerId })`

---

## 9. JWT Storage Policy
- **Server**: Short-lived verification in memory; `JWT_SECRET` stored in environment variables. JWTs are never written to database tables or server log files.
- **Client**: Tokens stored securely in encrypted Android Keystore / EncryptedSharedPreferences.

---

## 10. Identity-Provider Separation
Setu DigiLocker eKYC identity verification creates an `IdentityVerification` record tied to `req.user.workerId`. The authoritative credential issuing engine requires `status === 'VERIFIED'` in MongoDB before issuing signed Verifiable Credentials.

---

## 11. Threat Model
- **IDOR Attacks**: Blocked via strict ownership scoping in database queries.
- **Token Tampering / Forgery**: Blocked by HMAC-SHA256 signature check.
- **Algorithm Downgrade Attacks (`alg: none`)**: Blocked by enforcing `alg === 'HS256'`.
- **Identity Spoofing**: Blocked by deriving identity strictly from verified JWT `sub`.
- **Credential Theft / Leakage**: Suppressed by sanitizing loggers and error responses.

---

## 12. Test Matrix and Exact Results
All test suites passed:

| Test Suite | Total Tests | Passed | Status |
| :--- | :--- | :--- | :--- |
| `securityHardening.test.ts` | 20 | 20 | PASS |
| `api.test.ts` | 17 | 17 | PASS |
| `integration.test.ts` | 13 | 13 | PASS |
| `pipeline.test.ts` | 12 | 12 | PASS |
| `pipelineIdentityGate.test.ts` | 18 | 18 | PASS |
| `identityApi.test.ts` | 10 | 10 | PASS |
| `identityVerificationModel.test.ts` | 7 | 7 | PASS |
| `setuDigiLockerService.test.ts` | 10 | 10 | PASS |

---

## 13. Mock/Fallback Limitations
During database connectivity outages, fallback responses strictly check `req.user.workerId` and return mock data only when matching demo worker identities (`OS-DEMO-001`).

---

## 14. Production versus Hackathon/Demo Distinctions
- **Production**: JWTs issued by centralized Auth Service with short expiry (15m-1h) and public key rotation.
- **Demo/Development**: Local HMAC-SHA256 tokens using `JWT_SECRET` with 24h expiration.

---

## Verdict

```text
PASS
```
