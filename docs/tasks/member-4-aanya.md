# Developer Task Specifications: Member 4 (Aanya)

# Role
Android Security & On-Device Processing Lead

# Primary Ownership
Android Notification Listener, Parsers, Local Encrypted Vault & Tamper-Evident Hash Chain (`apps/android/app/src/main/java/com/onshift/app/notifications/`, `data/vault/`, `data/hashchain/`)

# Secondary Ownership
Notification parsing strategies, Room database local caching, Android Keystore security, SHA-256 hash chain tamper verification.

# Mandatory Technical Demonstration (20-Second Pitch Moment)
Aanya owns one of OnShift's strongest technical demonstration moments:
1. Show valid hash chain: `verifyHashChain()` returns **`VALID ✓`**.
2. Modify a historical evidence record amount (e.g. ₹2,400 → ₹9,400).
3. Run `verifyHashChain()`: returns **`INVALID ✗`** and identifies the `brokenAt` record ID.
4. **Pitch Message**: *"The system doesn't claim data is impossible to change. It makes post-capture alteration detectable."*

# Objective
Implement on-device notification parsing for Zomato, Swiggy, and Uber, store evidence in an Android Keystore-backed local encrypted vault, and compute sequential SHA-256 hash chains for local evidence tamper detection.

# Why This Matters to OnShift
Aanya owns the core privacy and provenance foundation. OnShift captures notifications on-device without private backend platform APIs, protecting raw data in a local encrypted vault and ensuring historical records cannot be silently modified without failing hash chain verification.

# Exact Files / Directories Owned
- `apps/android/app/src/main/java/com/onshift/app/notifications/NotificationParser.kt`
- `apps/android/app/src/main/java/com/onshift/app/notifications/ZomatoParser.kt`
- `apps/android/app/src/main/java/com/onshift/app/notifications/SwiggyParser.kt`
- `apps/android/app/src/main/java/com/onshift/app/notifications/UberParser.kt`
- `apps/android/app/src/main/java/com/onshift/app/notifications/GenericParser.kt`
- `apps/android/app/src/main/java/com/onshift/app/notifications/OnShiftNotificationListenerService.kt`
- `apps/android/app/src/main/java/com/onshift/app/data/vault/EvidenceRepository.kt`
- `apps/android/app/src/main/java/com/onshift/app/data/vault/LocalEncryptedEvidenceRepository.kt`
- `apps/android/app/src/main/java/com/onshift/app/data/hashchain/HashChain.kt`
- `apps/android/app/src/test/java/com/onshift/app/HashChainTest.kt`

# P0 Tasks
1. **Notification Parsers**: Implement regex parsing logic for Zomato, Swiggy, and Uber notification snippets.
2. **Notification Listener Service**: Register and test `OnShiftNotificationListenerService` in `AndroidManifest.xml`.
3. **Encrypted Evidence Vault**: Implement `EvidenceRepository` interface using Android Keystore / EncryptedSharedPreferences.
4. **Tamper-Evident Hash Chain**: Implement `HashChain` engine computing `currentHash = SHA256(recordData + previousHash)`.
5. **Tamper Detection Verification**: Implement `verifyHashChain(records)` returning `valid`, `brokenAt`, and `reason`.
6. **Hash Chain Unit Test**: Verify `HashChainTest` detects record tampering, deletion, or reordering.

# P1 Tasks
1. Support background batch sync of normalized evidence to local Room DB.
2. Add regex parsers for additional delivery platforms (e.g. Zepto, Blinkit).

# Explicitly Out of Scope
- Server-side MongoDB queries (Owned by Rimjhim).
- Python verification engine scoring (Owned by Apoorva).
- Web verifier portal (Owned by Surbhi).

# Dependencies
- Shared domain schemas (`@onshift/shared-types`).
- Android Security Crypto library (`androidx.security:security-crypto`).

# Interfaces to Expose
Kotlin Interfaces & Utility Functions:
- `NotificationParser.parse(packageName, text)`
- `EvidenceRepository.saveEvidence(record)`
- `EvidenceRepository.getAllEvidence()`
- `HashChain.calculateRecordHash(record, previousHash)`
- `HashChain.verifyHashChain(records): HashChainValidationResult`

# Inputs Required
- System notification title and body text snippets.
- Evidence record domain objects.

# Outputs Expected
- `ParsedNotificationEvidence` objects (amount, platform, reference).
- `HashChainValidationResult` (`valid: Boolean`, `brokenAt: String?`, `reason: String`).

# Implementation Requirements
- **Tamper Detection**: Sequential SHA-256 chaining. Do NOT call this blockchain.
- **Local-First Privacy**: Raw notification text MUST remain on-device in local vault.
- **Deterministic Fixtures**: Provide deterministic notification fixtures so UI testing is never blocked by physical device notifications.

# Security Requirements
- Store vault keys inside Android Keystore.
- Do not print unmasked notification strings to public `Logcat` logs in release builds.

# Testing Requirements
Run JUnit test `HashChainTest.kt`:
- Test 1: Valid sequential hash chain returns `valid = true`.
- Test 2: Modified historical record returns `valid = false` and identifies `brokenAt` ID.

# Demo Requirements
Provide a controlled tampering demo button in UI to showcase tamper detection (`verifyHashChain` detecting record modification).

# Failure / Fallback Strategy
If physical notification listener permission is denied by Android OS, fallback smoothly to deterministic notification fixtures. Downstream processing MUST be identical.

# Known Risks
Notification string formats vary by app version. **Mitigation**: Use robust fallback regex matchers (`GenericParser`).

# Potential Blockers
Android permission prompt for Notification Listener. **Mitigation**: Use sample fixtures during initial UI development.

# Who Depends on This Work
- Member 1 (Sadhana) renders evidence timeline and vault integrity status in Android UI.
- Member 3 (Rimjhim) receives normalized evidence payloads.

# What This Person Depends On
- Shared domain contracts (`packages/shared-types`).

# Handoff Checklist
- `HashChainTest` passes JUnit execution.
- `LocalEncryptedEvidenceRepository` saves and retrieves evidence records.
- Notification parsers parse sample strings for Zomato and Swiggy.

# Definition of Done
1. NotificationListenerService registered and parsing Zomato/Swiggy notifications.
2. Evidence saved in local encrypted vault.
3. Hash chain computes SHA-256 provenance hashes.
4. `verifyHashChain()` detects tampered records in unit test.

# Day 1 Goals
Build notification parsers, encrypted vault repository, and hash chain engine.

# Day 2 Goals
Connect Android notification listener to Compose UI and run hash chain tamper tests.

# Day 3 Goals
Refine regex matchers and freeze security test suite.

# Final Evaluation Checklist
- [ ] `HashChainTest` passes JUnit verification.
- [ ] Notification parsers extract earnings from Zomato and Swiggy text.
- [ ] Encrypted local vault initialized with Android Keystore.
- [ ] Controlled tamper detection demo verified.
