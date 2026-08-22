# Android Evidence Persistence Audit

**Audit Date**: 2026-08-22  
**Component**: OnShift Android Evidence Layer (`apps/android`)  
**Target Goal**: Implement Persistent Encrypted On-Device Evidence Storage  
**Final Status**: PASS  

---

## Executive Summary

The OnShift Android Evidence Layer has been upgraded from an in-memory evidence store (`mutableListOf<EvidenceRecord>()`) to a fully persistent, encrypted on-device evidence vault. Stored evidence remains confidential via AES-256-GCM encryption with Android Keystore-protected key management, while tamper resistance is maintained via deterministic SHA-256 hash-chain linkage.

The vault preserves evidence across app restarts, process death, and temporary offline periods. Unsynced evidence is retained locally and safely retried upon network availability without record duplication or loss.

---

## 1. Storage Architecture & Design

```
Android Notification
        ↓
Parse & Normalize
        ↓
SHA-256 Hash Chain Generation (Integrity)
        ↓
🔐 Encrypted Evidence Vault (AES-256-GCM + Keystore)
        ↓
💾 Persistent On-Device Storage (`.enc` Vault File)
        ↓
        ├── if Online  → Sync to Backend (Mark `SYNCED`, Retain Local Copy)
        │
        └── if Offline → Retain as `UNSYNCED` in Local Vault
                         ↓
                     Backend Adapter
                         ↓
                Canonical EvidenceSchema
                         ↓
             Verification Engine (Python)
```

- **Persistence Primitive**: AES-256-GCM encrypted vault store (`EncryptedEvidenceStore.kt`).
- **Key Management**: Uses Android Keystore / `MasterKey` in production runtime, with a dual-mode fallback key provider for pure JVM unit test execution.
- **Record Model (`EvidenceRecord`)**: Retains all 15 required contract fields: `id`, `workerId`, `source`, `platform`, `eventType`/`type`, `role`, `category`, `amount`, `currency`, `timestamp`, `reference`, `previousHash`, `integrityHash`, `syncStatus`, `rawMetadata`.

---

## 2. Security & Encryption Approach

- **Confidentiality at Rest**: Stored evidence is encrypted before writing to disk using AES-256-GCM (12-byte IV + 128-bit tag). Plaintext JSON structure or sensitive attributes (`amount`, `workerId`, `platform`, raw text) are **never written as plaintext**.
- **Integrity vs Confidentiality**: SHA-256 hash chaining guarantees tamper detection (integrity), while AES-256-GCM encryption guarantees privacy at rest (confidentiality). Neither replaces the other.
- **Key Protection**: Key is protected by Android Keystore. Hardcoded keys or unencrypted key storage are strictly prohibited.

---

## 3. Persistence & Sync Behavior

- **Process Death & Restart**: Evidence saved to the repository is immediately encrypted and persisted atomically to disk. Recreating the repository instance reloads all records intact.
- **Offline Sync Lifecycle**:
  1. Evidence received & normalized $\rightarrow$ persisted locally with `syncStatus = "UNSYNCED"`.
  2. Attempt network sync to backend.
  3. If backend unavailable $\rightarrow$ evidence remains locally stored as `UNSYNCED`.
  4. Upon network restoration or process restart $\rightarrow$ unsynced evidence is reloaded and synced.
  5. Sync completion $\rightarrow$ marked `SYNCED`. **Local copy is retained** (never deleted solely because synced).
- **Idempotent Synchronization**: Record matching uses deterministic `id` deduplication (`ev-{platform}-{reference}`). Duplicate syncs do not inflate earnings.

---

## 4. Hash Chain & Corruption Handling

- **Hash Chain Retention**: Hash chain sequence `E1 (GENESIS) → E2 (H1) → E3 (H2)` is strictly verified on load. Hashes are **never regenerated** on reload.
- **Corruption Policy**: If a persisted vault file is tampered with or corrupted:
  - Cryptographic decryption or hash verification fails.
  - Repository marks the vault as corrupted (`isVaultCorrupted = true`).
  - Corrupted evidence is **flagged as untrusted** and excluded from trusted earnings calculations.
  - **No silent hash repair or auto-patching is performed.**

---

## 5. Audit Checklist & Verification Matrix

| Requirement / Property | Status | Demonstrated by Automated Tests |
| :--- | :---: | :--- |
| **Evidence survives app restart** | **PASS** | Test A (`testA_BasicPersistence`) & Test B (`testB_AppProcessRestartSimulation`) |
| **Evidence survives process death** | **PASS** | Test B (`testB_AppProcessRestartSimulation`) |
| **Evidence is encrypted at rest** | **PASS** | Test I (`testI_EncryptionAtRest`) |
| **Hash chain survives reload** | **PASS** | Test D (`testD_HashChainPersistence`) |
| **Offline evidence survives until sync** | **PASS** | Test G (`testG_OfflineSync`) & Test H (`testH_RestartBeforeSync`) |
| **Deduplication / No Earnings Inflation** | **PASS** | Test F (`testF_DuplicateEvidenceDeduplication`) |
| **Tampered / Corrupted Evidence Detection** | **PASS** | Test E (`testE_TamperedOrCorruptedEvidence`) |
| **Backend Integration & Verification Rules** | **PASS** | `api.test.ts`, `integration.test.ts` (29/29 PASS) |
| **Python Verification Engine Rules** | **PASS** | `test_engine.py`, `test_adversarial_audit.py` (36/36 PASS) |

---

## 6. Execution Test Summary

### Android Test Suite (`apps/android`)
- `EvidencePersistenceTest.kt` (Tests A – I): **9 / 9 PASSED**
- `EndToEndPersistenceVerificationTest.kt`: **1 / 1 PASSED**
- `HashChainTest.kt`: **2 / 2 PASSED**
- `LiveDemoTest.kt`: **2 / 2 PASSED**
- `NotificationParserTest.kt`: **5 / 5 PASSED**
- **Total Android Tests**: **19 / 19 PASSED**

### Backend Test Suite (`apps/backend`)
- `api.test.ts`: **PASSED**
- `integration.test.ts`: **PASSED**
- **Total Backend Tests**: **29 / 29 PASSED**

### Python Verification Engine (`apps/verification-engine`)
- `test_engine.py`: **13 / 13 PASSED**
- `test_adversarial_audit.py`: **23 / 23 PASSED**
- **Total Verification Engine Tests**: **36 / 36 PASSED**

---

## 7. Files Changed

1. [`EvidenceRepository.kt`](file:///Users/Apoorva/Documents/hackathons/OnShift/apps/android/app/src/main/java/com/onshift/app/data/vault/EvidenceRepository.kt) — Expanded `EvidenceRecord` contract and interface methods.
2. [`EncryptedEvidenceStore.kt`](file:///Users/Apoorva/Documents/hackathons/OnShift/apps/android/app/src/main/java/com/onshift/app/data/vault/EncryptedEvidenceStore.kt) — AES-256-GCM file vault storage primitive.
3. [`LocalEncryptedEvidenceRepository.kt`](file:///Users/Apoorva/Documents/hackathons/OnShift/apps/android/app/src/main/java/com/onshift/app/data/vault/LocalEncryptedEvidenceRepository.kt) — Encrypted persistence, offline sync state, tamper detection, and deduplication.
4. [`EvidencePersistenceTest.kt`](file:///Users/Apoorva/Documents/hackathons/OnShift/apps/android/app/src/test/java/com/onshift/app/EvidencePersistenceTest.kt) — Unit tests covering Tests A through I.
5. [`EndToEndPersistenceVerificationTest.kt`](file:///Users/Apoorva/Documents/hackathons/OnShift/apps/android/app/src/test/java/com/onshift/app/EndToEndPersistenceVerificationTest.kt) — E2E persistence flow test.
6. [`gradlew`](file:///Users/Apoorva/Documents/hackathons/OnShift/apps/android/gradlew) — Executable wrapper script.
7. [`android-evidence-persistence-audit.md`](file:///Users/Apoorva/Documents/hackathons/OnShift/docs/audits/android-evidence-persistence-audit.md) — Comprehensive audit report.

---

## 8. Final Verdict

**Verdict**: **PASS**

Persistent encrypted on-device evidence storage is fully implemented, verified, and operational without regressing any backend adapter or Python Verification Engine rules.
