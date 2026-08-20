# Developer Task Specifications: Member 5 (Nidhi)

# Role
Cryptographic Systems & Account Aggregator Lead (Coordinated Workstream with Member 3: Rimjhim)

# Primary Ownership
Ed25519 Credential Schema & Account Aggregator Architecture (`packages/credential-schema/`, `apps/android/.../aa/`)

# Secondary Ownership
Digital signatures, selective disclosure credential serialization, Account Aggregator provider interfaces, financial transaction normalization.

# Workstream Coordination (Member 5 & Member 3)
Nidhi and Rimjhim operate as a joint backend-crypto-financial team. Nidhi owns Ed25519 cryptographic signing/verification routines, selective disclosure credential construction, and the Account Aggregator adapter architecture. Rimjhim owns Express REST controllers and MongoDB database persistence. They publish schema contracts early to unblock Member 1 (UI) and Member 6 (Web Verifier).

# Mandatory Technical Demonstration (20-Second Pitch Moment)
Nidhi owns the credential tamper detection demonstration:
1. Paste valid credential JSON into Verifier Web App: returns **`✓ Valid Signature & Issuer`**.
2. Modify verified income number in JSON textarea (e.g. ₹30,100 → ₹50,100).
3. Click Verify: returns **`✗ Verification Failed`**.
4. **Pitch Message**: *"Credentials cannot be modified by the worker or third parties without invalidating the Ed25519 signature."*

# Account Aggregator Checkpoint
Before declaring AA integration complete, verify:
- [ ] Provider interface identified (`AccountAggregatorProvider`).
- [ ] Real sandbox access investigated (Setu/Sahamati).
- [ ] Authentication and consent flow understood.
- [ ] Financial data response schema documented.
- [ ] Sandbox adapter implemented if accessible.
- [ ] Mock adapter conforms to identical interface and schema.
- [ ] Mock fallback is visibly labeled as mock.
- [ ] Reconciliation engine consumes normalized AA data identically.
- [ ] Unavailable AA state handled gracefully.

# Objective
Implement standard Ed25519 cryptographic credential generation, selective disclosure filtering, and a clean Account Aggregator provider adapter pattern supporting real sandbox investigation and mock fallback.

# Why This Matters to OnShift
Nidhi owns the core trust mechanics: creating signed portable proof credentials that third-party verifiers can independently validate, and managing financial evidence collection via Account Aggregator.

# Exact Files / Directories Owned
- `packages/credential-schema/src/index.ts`
- `packages/credential-schema/package.json`
- `packages/credential-schema/tsconfig.json`
- `apps/android/app/src/main/java/com/onshift/app/data/aa/AccountAggregatorProvider.kt`
- `apps/android/app/src/main/java/com/onshift/app/data/aa/MockAccountAggregatorProvider.kt`

# P0 Tasks
1. **Ed25519 Credential Signing (`signCredential`)**:
   - Construct `OnShiftIncomeCredential` JSON structure.
   - Compute Ed25519 signature over serialized claims payload using issuer key.
2. **Ed25519 Signature Verification (`verifyCredentialSignature`)**:
   - Parse credential payload and verify signature against issuer public key.
   - Return valid/invalid status and claims without exposing undisclosed raw fields.
3. **Selective Disclosure Builder**:
   - Filter claims based on worker selection (Verified Income, Period, Verification Level).
4. **Account Aggregator Adapter Pattern**:
   - Implement `AccountAggregatorProvider` interface (`requestConsent`, `fetchFinancialData`, `revokeConsent`).
   - Investigate live AA sandbox (Setu/Sahamati). If unreachable, implement `MockAccountAggregatorProvider` returning schema-identical financial transactions.
5. **Credential Tampering Test**:
   - Verify that altering any character in signed claims payload causes `verifyCredentialSignature` to return `valid = false`.

# P1 Tasks
1. Web Crypto API compatibility for browser-native verification.
2. Add support for multiple financial account linkage normalization.

# Explicitly Out of Scope
- Custom cryptographic primitives (Use standard Node `crypto` / Ed25519).
- W3C DID heavy infrastructure (Keep credentials simple and portable).
- Android Compose screen styling (Owned by Sadhana).

# Dependencies
- Shared domain schemas (`@onshift/shared-types`).
- Node.js native `crypto` module (Ed25519 support).

# Interfaces to Expose
TypeScript & Kotlin Functions:
- `generateEd25519KeyPair(): KeyPairHex`
- `signCredential(workerId, claims, privateKeyHex, publicKeyHex, issuer): Credential`
- `verifyCredentialSignature(credential): CredentialVerificationResult`
- `AccountAggregatorProvider.requestConsent(request): AAConsentResponse`
- `AccountAggregatorProvider.fetchFinancialData(consentId): List<AATransaction>`

# Inputs Required
- Worker pseudonym ID (`OS-DEMO-001`).
- Worker selective disclosure claim choices (`includeVerifiedIncome`, `includePeriod`, `includeVerificationLevel`).
- Issuer private and public key hex strings.

# Outputs Expected
- Signed `OnShiftIncomeCredential` JSON payload.
- `CredentialVerificationResult` (`valid: Boolean`, `signatureVerified: Boolean`, `claims: CredentialClaim`).

# Implementation Requirements
- **Standard Cryptography**: Use standard Ed25519. Do NOT implement manual cryptographic math primitives.
- **Selective Disclosure**: Resulting credential MUST contain ONLY selected claims.
- **Explicit AA Mock Label**: Mock provider MUST be explicitly labeled `MockAccountAggregatorProvider` (never disguise mock as live production banking).

# Security Requirements
- Store private keys in `.env` or Keystore. Never commit private keys to git repositories.

# Testing Requirements
Run credential tests in `apps/backend/tests/api.test.ts`:
- Test 1: Valid credential signing & verification roundtrip returns `valid = true`.
- Test 2: Modified claim payload returns `valid = false`.
- Test 3: Modified signature string returns `valid = false`.

# Demo Requirements
Provide canonical sample signed credential for worker Ravi Kumar (`OS-DEMO-001`) with ₹30,100 verified income.

# Failure / Fallback Strategy
If AA sandbox API returns authentication error or timeout, switch seamlessly to `MockAccountAggregatorProvider`.

# Known Risks
Discrepancies in Buffer vs ArrayBuffer representation across Node and browser environments. **Mitigation**: Use hex string encoding for keys and signatures.

# Potential Blockers
Waiting for backend routes. **Mitigation**: Publish `@onshift/credential-schema` early so Member 6 (Surbhi) can build Verifier Web App independently.

# Who Depends on This Work
- Member 6 (Surbhi) uses `verifyCredentialSignature` in Web Verifier.
- Member 3 (Rimjhim) uses `signCredential` in Express backend `/credentials/issue`.
- Member 1 (Sadhana) renders credential preview in Android UI.

# What This Person Depends On
- Shared domain types (`packages/shared-types`).

# Handoff Checklist
- `@onshift/credential-schema` compiles cleanly to `dist/`.
- Credential signing & signature verification test passes in Jest.
- `MockAccountAggregatorProvider` returns normalized bank settlements.

# Definition of Done
1. Ed25519 signing and verification working cleanly.
2. Selective disclosure includes only user-checked claims.
3. Credential tampering test fails as expected.
4. Account Aggregator provider interface implemented with working mock fallback.

# Day 1 Goals
Build `credential-schema` package, Ed25519 signing helpers, and freeze credential JSON structure with Rimjhim.

# Day 2 Goals
Connect credential signing to Express backend and implement Account Aggregator mock provider.

# Day 3 Goals
Perform credential tampering tests and verify browser compatibility with Surbhi.

# Final Evaluation Checklist
- [ ] Ed25519 credential signature generation operational.
- [ ] Signature verification returns `valid = true` for authentic credentials.
- [ ] Tampered credentials fail verification (`valid = false`).
- [ ] Account Aggregator interface implemented with clean mock fallback.
