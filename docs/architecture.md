# OnShift Architecture Overview

OnShift is a worker-owned application designed to aggregate, reconcile, and verify fragmented gig-work activity and financial records into signed, privacy-preserving portable credentials.

## Conceptual Pipeline

```
IDENTITY (Pseudonymous Worker ID)
    ↓
EVIDENCE COLLECTION (Declared, Observed Notification, Financial AA)
    ↓
PROVENANCE & TAMPER-EVIDENT HASH CHAIN (Local SHA-256 Chaining)
    ↓
RECONCILIATION ENGINE (Explained vs Unexplained Discrepancy Matching)
    ↓
VERIFICATION ENGINE (DECLARED → OBSERVED → CORROBORATED → FINANCIALLY_CORROBORATED)
    ↓
PRIVACY LAYER & SELECTIVE DISCLOSURE (Worker-selected claims)
    ↓
SIGNED PORTABLE CREDENTIAL (Ed25519 Cryptographic Proof)
    ↓
EXTERNAL VERIFIER & SCHEME MATCHING (Portal & Deterministic Eligibility)
```

## System Components

1. **Android Client (`apps/android`)**
   - Built with Kotlin and Jetpack Compose.
   - Captures gig notifications via `NotificationListenerService`.
   - Stores evidence in `LocalEncryptedEvidenceRepository` via Android Keystore.
   - Computes local `HashChain` for tamper-evident provenance.
   - Interfaces with Account Aggregator mock provider.

2. **Node.js Express Backend (`apps/backend`)**
   - Acts as the central REST API gateway and persistence manager via MongoDB & Mongoose ODM.
   - Exposes endpoint contracts for workers, evidence submission, credential issuance, and government schemes.
   - Proxies complex reconciliation and verification calculations to the Python Verification Engine.

3. **Python Verification Engine (`apps/verification-engine`)**
   - Built with FastAPI and Pydantic.
   - Executes deterministic reconciliation rules (MATCHED, EXPLAINED_DIFFERENCE, UNEXPLAINED_DIFFERENCE, INSUFFICIENT_EVIDENCE).
   - Computes human-explainable verification levels and confidence scores without machine learning.

4. **React Web Verifier (`apps/verifier-web`)**
   - Built with React, Vite, and TypeScript.
   - Enables third-party verifiers (banks, landlords, scheme admins) to paste or upload Ed25519-signed credentials.
   - Verifies cryptographic signature and issuer authenticity client-side.
   - Displays disclosed claims without leaking undisclosed transaction history.

5. **Shared Packages (`packages/*`)**
   - `shared-types`: Unified TypeScript interfaces used across backend and web.
   - `credential-schema`: JSON schema definitions and Ed25519 signing/verification helpers.
   - `mock-data`: Canonical deterministic demo datasets for Ravi Kumar (Scenarios 1 & 2).

## Verification Levels

- **DECLARED**: Worker explicit self-declaration only.
- **OBSERVED**: Platform order/payout notification captured on-device.
- **CORROBORATED**: Multiple observed platform records cross-reconciled.
- **FINANCIALLY_CORROBORATED**: Platform activity reconciled with bank settlement records.
