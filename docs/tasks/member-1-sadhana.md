# Developer Task Specifications: Member 1 (Sadhana)

# Role
Android Worker UI & Frontend Lead

# Primary Ownership
Worker-facing Android Application User Interface (`apps/android/app/src/main/java/com/onshift/app/ui/`)

# Secondary Ownership
UX visualization, evidence timeline graphics, reconciliation status presentation, selective disclosure UI workflow.

# Objective
Build a clean, high-credibility Jetpack Compose user interface for gig workers that visually represents evidence collection, reconciliation results, privacy settings, selective disclosure claim selection, signed credential preview, and government scheme discovery without inventing custom verification logic.

# Single Source of Truth Rule
**No UI component may invent its own interpretation of evidence strength or verification status.** The UI MUST consume the `VerificationResult` returned by Member 2's Python Verification Engine via backend API responses.

# Why This Matters to OnShift
Sadhana's work provides the primary visual interface during evaluation. The UI must clearly demonstrate the core OnShift trust architecture: turning scattered evidence into evidence-based income proof, while transparently representing actual engine states.

# Exact Files / Directories Owned
- `apps/android/app/src/main/java/com/onshift/app/ui/screens/IdentityScreen.kt`
- `apps/android/app/src/main/java/com/onshift/app/ui/screens/HomeScreen.kt`
- `apps/android/app/src/main/java/com/onshift/app/ui/screens/EvidenceScreen.kt`
- `apps/android/app/src/main/java/com/onshift/app/ui/screens/ReconciliationScreen.kt`
- `apps/android/app/src/main/java/com/onshift/app/ui/screens/VerificationScreen.kt`
- `apps/android/app/src/main/java/com/onshift/app/ui/screens/PrivacyScreen.kt`
- `apps/android/app/src/main/java/com/onshift/app/ui/screens/SelectiveDisclosureScreen.kt`
- `apps/android/app/src/main/java/com/onshift/app/ui/screens/CredentialScreen.kt`
- `apps/android/app/src/main/java/com/onshift/app/ui/screens/GovernmentSchemesScreen.kt`
- `apps/android/app/src/main/java/com/onshift/app/ui/theme/`

# P0 Tasks
1. **Compose Navigation**: Wire tabbed or sequential flow across all 9 screens.
2. **Dashboard & Evidence Timeline**: Render Declared, Observed (Zomato/Swiggy/Uber), and Financial AA records with source badges.
3. **Reconciliation Display**: Render expected earnings (₹30,100), actual settlement, and status badges (`MATCHED` vs `UNEXPLAINED_DIFFERENCE`).
4. **Verification Level Card**: Present level (`FINANCIALLY_CORROBORATED` / `CORROBORATED`), confidence score (0.96 / 0.72), and human-readable explanation reason.
5. **Selective Disclosure Checkboxes**: Allow worker to toggle claims (Verified Income, Period, Verification Level).
6. **Signed Credential View**: Display generated Ed25519 signature preview.
7. **Tampering Demo Button**: Provide a button on Evidence/Privacy screen to trigger a simulated record edit and show `verifyHashChain()` flip to `INVALID ✗`.

# P1 Tasks
1. Advanced evidence timeline micro-animations and smooth transition effects.
2. Dark mode fintech styling refinements.

# Explicitly Out of Scope
- Backend MongoDB queries (Owned by Rimjhim).
- Cryptographic Ed25519 signature calculations (Owned by Nidhi).
- Python verification engine rules (Owned by Apoorva).
- Notification listener background service logic (Owned by Aanya).

# Dependencies
- Shared domain types (`@onshift/shared-types`).
- Canonical demo data fixtures (`@onshift/mock-data`).
- Android evidence repository interface (`EvidenceRepository`).

# Interfaces to Expose
Jetpack Compose Screen functions:
- `IdentityScreen()`
- `HomeScreen(workerState)`
- `EvidenceScreen(evidenceList, hashChainValid)`
- `ReconciliationScreen(result)`
- `VerificationScreen(verification)`
- `PrivacyScreen(privacyRecord)`
- `SelectiveDisclosureScreen(onClaimsSelected)`
- `CredentialScreen(credential)`
- `GovernmentSchemesScreen(schemeMatches)`

# Inputs Required
Domain state objects (`Worker`, `Evidence[]`, `ReconciliationResult`, `VerificationResult`, `Credential`).

# Outputs Expected
User-selected claims payload passed to credential signing service.

# Implementation Requirements
- Use Jetpack Compose Material 3 design tokens.
- **Strict Text Rule**: Do NOT use em dashes (`—`) in user-facing UI text. Use colons, commas, periods, or standard characters instead.
- Use actual Unicode currency symbols (`₹`).

# Security Requirements
- Do not log or display raw Aadhaar numbers or full unmasked bank account numbers in UI logs.

# Testing Requirements
- UI state rendering unit tests / preview checks for loading, error, empty, and populated states.

# Demo Requirements
- Support Scenario 1 (`MATCHED` ₹30,100) and Scenario 2 (`UNEXPLAINED_DIFFERENCE` ₹600 shortfall: Expected ₹30,100, Actual ₹29,500).

# Failure / Fallback Strategy
If backend API is unreachable, switch UI state seamlessly to canonical `@onshift/mock-data` fixtures.

# Known Risks
Backend API latency during live pitch presentation.

# Potential Blockers
Waiting for backend routes. **Mitigation**: Use `@onshift/mock-data` locally so UI work is never blocked.

# Who Depends on This Work
Demonstrates the entire application visually to judges.

# What This Person Depends On
- Member 4 (Aanya) for evidence repository data.
- Member 2 (Apoorva) for verification engine result schema.
- Member 5 (Nidhi) for credential payload preview.

# Handoff Checklist
- All 9 screens build without Kotlin compilation errors.
- Navigation operates smoothly.
- Zero em dashes in user-facing UI strings.

# Definition of Done
1. All 9 Compose screens implemented and navigable.
2. State displays reflect actual domain models returned by verification engine.
3. Selective disclosure checkbox toggles produce updated claim selection output.
4. Demo scenarios 1 and 2 render cleanly.

# Day 1 Goals
Complete Compose navigation shell and static layout designs for all 9 screens using mock data.

# Day 2 Goals
Wire UI screens to live Android `EvidenceRepository` and Express API endpoints.

# Day 3 Goals
UI polish, dark mode tuning, and verification level presentation freeze.

# Final Evaluation Checklist
- [ ] Navigable 9-screen worker flow.
- [ ] Clear visual distinction between DECLARED, OBSERVED, and FINANCIAL evidence.
- [ ] Transparent reconciliation status display (MATCHED vs UNEXPLAINED_DIFFERENCE ₹600 shortfall).
- [ ] Selective disclosure checkboxes update credential output preview.
- [ ] Tampering demo button triggers hash chain invalidation preview.
