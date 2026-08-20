# OnShift Team Ownership Matrix

The repository is structured to enable 6 developers to work simultaneously without cross-module friction.

## Member 1 — Sadhana
- **Primary**: Frontend & UI Development (Flutter/Kotlin UI, UX, Visualization)
- **Owns**: `apps/android/app/src/main/java/com/onshift/app/ui/`
- **Interfaces Consumed**: `EvidenceRepository`, `AccountAggregatorProvider`, `HashChain`.
- **Interfaces Provided**: Navigation and worker-facing dashboard components.
- **Definition of Done**: Clean Jetpack Compose UI screens for Identity, Home, Evidence, Reconciliation, Verification, Privacy, Credential, Schemes.

## Member 2 — Apoorva
- **Primary**: FinTech & Verification Systems (Python, FastAPI, Data Processing)
- **Owns**: `apps/verification-engine/`
- **Interfaces Consumed**: `packages/shared-types` domain objects.
- **Interfaces Provided**: `/reconciliation/run` and `/verification/level` FastAPI endpoints.
- **Definition of Done**: Rule-based Python reconciliation and verification level pipeline with pytest coverage.

## Member 3
- **Primary**: Backend Development (Node.js, TypeScript, REST APIs, MongoDB)
- **Owns**: `apps/backend/`
- **Interfaces Consumed**: `packages/shared-types`, Python verification-engine endpoints.
- **Interfaces Provided**: Express REST API endpoints (`/api/v1/...`) and MongoDB persistence via Mongoose.
- **Definition of Done**: Backend server passes integration tests, seeds demo data, handles CORS, and exposes documented routes.

## Member 4 — Aanya
- **Primary**: Android & Cybersecurity (Kotlin, On-device Processing, Hash Chains)
- **Owns**: `apps/android/app/src/main/java/com/onshift/app/notifications/`, `data/vault/`, `data/hashchain/`
- **Interfaces Consumed**: Android system NotificationListenerService and Keystore APIs.
- **Interfaces Provided**: `NotificationListenerService`, `NotificationParser`, `LocalEncryptedEvidenceRepository`, `HashChain.verifyHashChain()`.
- **Definition of Done**: Android parsers for Zomato/Swiggy notifications, local hash chain tamper detection, and encrypted vault repository.

## Member 5
- **Primary**: Cryptographic & Financial Systems (Ed25519, Credential Security, Account Aggregator)
- **Owns**: `packages/credential-schema/`, `apps/android/.../data/aa/`
- **Interfaces Consumed**: Standard crypto libraries (`crypto`, Ed25519).
- **Interfaces Provided**: Credential JSON schema, Ed25519 sign/verify routines, `MockAccountAggregatorProvider`.
- **Definition of Done**: Credential issuer signs claims, verifier validates Ed25519 signatures, mock AA returns normalized financial transactions.

## Member 6 — Surbhi
- **Primary**: Web & Application Integration (React, Deployment, Government Scheme Logic)
- **Owns**: `apps/verifier-web/`
- **Interfaces Consumed**: Credential verification logic, `/api/v1/credentials/verify`, `/api/v1/schemes/match`.
- **Interfaces Provided**: Verifier Portal React Web Application and scheme matching preview UI.
- **Definition of Done**: Clean responsive web app to paste/upload credentials, check signature status, render claims, and showcase government schemes.
