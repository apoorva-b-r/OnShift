# Developer Task Specifications: Member 6 (Surbhi)

# Role
AI-Powered Government Scheme Recommendation & Web Integration Lead

# Primary Ownership
AI-Powered Government Scheme Recommendation Engine & External Verifier Web Integration (`apps/verifier-web/`, `apps/backend/src/controllers/schemeController.ts`)

# Secondary Ownership
React, scheme data engineering, structured eligibility logic, Nemotron Ultra 3 LLM integration, REST API contracts.

# Architectural Separation Rule
**The External Verifier and Government Scheme Recommendation are SEPARATE technical flows.**
- The External Verifier independently validates Ed25519 credential signatures client-side.
- Nemotron Ultra 3 AI is used ONLY for ranking and generating natural-language explanations for government scheme recommendations.
- **Nemotron is NEVER involved in deciding whether a credential signature is valid.**

# Scheme Pipeline Architecture
```
WORKER PROFILE (Structured Profile Data + Financial/Work Data)
       │
       ↓
GOVERNMENT SCHEME KNOWLEDGE BASE
       │
       ↓
STRUCTURED ELIGIBILITY FILTER (Deterministic: Occupation, Income, Location, Category)
       │
       ↓
Candidate Schemes
       │
       ↓
NEMOTRON ULTRA 3
  /              \
 ↓                ↓
Relevance Ranking  Natural-Language Explanation
  \              /
   ↓            ↓
Personalized Scheme Recommendations
       │
       ↓
React Worker Interface / Verifier Integration
```

# Deterministic Fallback Architecture
```
Scheme Data → Eligibility Rules → Candidate List → Nemotron API Available?
   ├── YES → AI ranking + natural-language explanation (NEMOTRON_ULTRA_3)
   └── NO  → Deterministic ranked fallback result (DETERMINISTIC_FALLBACK)
```
*Rule*: If Nemotron API is unavailable or rate-limited during a pitch demo, the Government Schemes feature MUST NOT break. It falls back smoothly to deterministic ranking.

# Objective
Build the AI-Powered Government Scheme Recommendation engine with Nemotron Ultra 3 and robust deterministic fallback, expose `POST /api/v1/schemes/recommend`, and maintain the standalone React + Vite Web Verifier app for independent Ed25519 signature validation.

# Why This Matters to OnShift
Surbhi's work adds high-value economic mobility to OnShift. Beyond verifying earnings, workers get tailored access to government micro-loans (PM SVANidhi) and pensions (e-Shram) using their verified profile data without LLMs hallucinating eligibility rules.

# Exact Files / Directories Owned
- `apps/verifier-web/src/App.tsx`
- `apps/verifier-web/src/main.tsx`
- `apps/verifier-web/src/index.css`
- `apps/verifier-web/package.json`
- `apps/verifier-web/vite.config.ts`
- `apps/verifier-web/README.md`
- Backend scheme recommendation controller: `apps/backend/src/controllers/schemeController.ts`

# P0 Tasks
1. **Government Scheme Data Engineering**:
   - Define structured scheme schema (id, name, description, min/max income, targetWorkerTypes, eligibilityRules, documents, applicationUrl).
   - Maintain catalog dataset (PM SVANidhi, e-Shram Pension, Ayushman Bharat).
2. **Structured Eligibility Filter**:
   - Filter candidate schemes deterministically BEFORE passing to LLM (evaluating occupation, income range ₹29,500, location, worker category).
3. **Nemotron Ultra 3 Integration (`recommendSchemes`)**:
   - Input: Worker profile + Candidate schemes + Structured filter results.
   - Output: Relevance ranking (`HIGH`, `MEDIUM`, `LOW`), natural-language explanation, relevant benefits, and missing information/uncertainties.
   - Wording: Use recommendation wording *"You may be a relevant candidate..."* (model explains & ranks, does NOT certify government eligibility).
4. **Deterministic Fallback**:
   - Implement `DETERMINISTIC_FALLBACK` path when `NEMOTRON_API_KEY` is absent or API is unreachable.
5. **Standalone External Verifier**:
   - React app to paste/upload signed credential JSON, execute client-side Ed25519 verification, and render disclosed claims.

# P1 Tasks
1. Sample credential reset button and scheme filter toggle UI.
2. Dark mode fintech styling polish.

# Explicitly Out of Scope
- Using LLMs to verify cryptographic signatures (Signatures use Ed25519 math ONLY!).
- Server-side database schema alterations (Owned by Rimjhim).
- Android Compose screen styling (Owned by Sadhana).

# Dependencies
- From Backend / Member 3 (Rimjhim): Worker profile, normalized income data, `POST /api/v1/schemes/recommend` endpoint.
- From Member 2 (Apoorva): Verification level (`FINANCIALLY_CORROBORATED`), verified income (₹30,100).
- From Member 5 (Nidhi): `@onshift/credential-schema` Ed25519 verification functions.

# Interfaces to Expose
Express Route & Web App:
- `POST /api/v1/schemes/recommend`
- `http://localhost:3000` (Verifier Web App)

# Inputs Required
- Worker profile payload (`monthlyIncome`, `workerCategory`, `location`, `verificationLevel`).
- Signed `OnShiftIncomeCredential` JSON text for Verifier App.

# Outputs Expected
- Scheme recommendations JSON:
```json
{
  "workerProfile": { "monthlyIncome": 29500, "workerCategory": "Delivery Partner" },
  "recommendations": [
    {
      "scheme": { "id": "SCHEME-PMSVANIDHI", "name": "PM SVANidhi" },
      "relevance": "HIGH",
      "matchReason": "You may be a relevant candidate based on your Delivery Partner occupation and financially corroborated income of INR 29,500.",
      "benefits": ["Special working capital loan up to INR 50,000"],
      "explanationSource": "NEMOTRON_ULTRA_3"
    }
  ],
  "engineSource": "NEMOTRON_ULTRA_3"
}
```

# Implementation Requirements
- **Structured Filter First**: LLM receives ONLY candidate schemes that passed structured rules.
- **Standalone Verifier**: Web Verifier MUST check Ed25519 signatures locally without asking backend.
- **No Em-Dashes**: UI strings must not contain em dashes (`—`).

# Security Requirements
- Verify issuer public key matches trusted OnShift public key (`d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a`).

# Testing Requirements
Run `npm --prefix apps/verifier-web run build`.
- Test 1: Nemotron recommendation route returns structured recommendations.
- Test 2: When API key is absent, `DETERMINISTIC_FALLBACK` handles recommendations cleanly without error.
- Test 3: Verifier Web App validates authentic credential JSON.

# Demo Requirements
Demonstrate live AI scheme recommendation generation and live credential tampering detection in Web Verifier.

# Failure / Fallback Strategy
If Nemotron API is unavailable, fallback smoothly to `DETERMINISTIC_FALLBACK`. The feature never breaks during pitch demos.

# Known Risks
LLM latency or API key expiration. **Mitigation**: Robust deterministic fallback architecture ensures instant response.

# Potential Blockers
Waiting for verified income figures. **Mitigation**: Use `@onshift/mock-data` default profile during development.

# Who Depends on This Work
- Member 1 (Sadhana) renders government scheme recommendations in Android UI.
- Demonstrates independent credential verification to judges.

# What This Person Depends On
- Member 2 (Apoorva) for verification level semantics.
- Member 5 (Nidhi) for credential signature verifier library.

# Handoff Checklist
- `POST /api/v1/schemes/recommend` returns ranked recommendations.
- Deterministic fallback operates cleanly when Nemotron API is offline.
- `npm --prefix apps/verifier-web run build` compiles into `dist/` with zero errors.

# Definition of Done
1. Government scheme structured filter & Nemotron Ultra 3 recommendation engine functional with fallback.
2. Endpoint `POST /api/v1/schemes/recommend` active.
3. React Verifier Web App running on port 3000 verifying Ed25519 credentials.

# Day 1 Goals
Build React verifier UI layout and implement structured eligibility filter in backend.

# Day 2 Goals
Integrate Nemotron Ultra 3 LLM prompt and deterministic fallback pipeline.

# Day 3 Goals
UI polish and live tampering demo verification.

# Final Evaluation Checklist
- [ ] React web verifier runs on port 3000.
- [ ] `POST /api/v1/schemes/recommend` returns ranked recommendations with explanations.
- [ ] Deterministic fallback operates cleanly when LLM API is unreachable.
- [ ] Valid credential passes signature check (`✓ Valid Signature & Issuer`).
- [ ] Tampered credential fails signature check (`✗ Verification Failed`).
