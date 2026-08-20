# Developer Task Specifications: Member 2 (Apoorva)

# Role
Evidence Verification & Financial Reconciliation Lead

# Primary Ownership
Python Verification Engine (`apps/verification-engine/`)

# Secondary Ownership
Evidence normalization, evidence strength weighting, payout-period reconciliation, deduction classification, conservative verification level scoring, explainability generation.

# Intellectual Core Contribution
Apoorva owns the core intelligence and analytical reasoning of OnShift:
- What evidence do we have? (Declared, Observed, Financial)
- How strong is each evidence source? (Self-report vs platform notification vs bank settlement)
- Do the sources agree? (Reconciliation matching)
- If not, why? (Explained deduction vs unexplained shortfall)
- What can we legitimately claim? (Conservative verification level & confidence)

# Single Source of Truth Rule
**The Python Verification Engine is the SINGLE SOURCE OF TRUTH for evidence strength and verification classification.** All other modules (Android UI, Backend, Web Verifier) MUST consume results from this engine.

# Objective
Implement deterministic rule-based algorithms for financial evidence reconciliation and verification level calculation in Python FastAPI, returning structured, explainable responses without relying on black-box machine learning or static hardcoded boolean flags.

# Why This Matters to OnShift
Apoorva's engine provides technical credibility during judge evaluation. When a judge asks *"Why isn't this financially corroborated?"*, the engine provides explicit, structured answers detailing the ₹600 settlement shortfall and missing deduction record.

# Exact Files / Directories Owned
- `apps/verification-engine/app/main.py`
- `apps/verification-engine/app/schemas/domain.py`
- `apps/verification-engine/app/services/reconciliation.py`
- `apps/verification-engine/app/services/verification.py`
- `apps/verification-engine/tests/test_engine.py`
- `apps/verification-engine/requirements.txt`
- `apps/verification-engine/README.md`

# P0 Tasks
1. **Reconciliation Engine Endpoint (`POST /reconciliation/run`)**:
   - Compute expected gross earnings, known platform deductions, expected net settlement, actual bank settlement, and difference.
   - Classify statuses: `MATCHED`, `EXPLAINED_DIFFERENCE`, `UNEXPLAINED_DIFFERENCE`, `INSUFFICIENT_EVIDENCE`.
   - Provide human-explainable notes and supporting evidence IDs.
2. **Verification Pipeline Endpoint (`POST /verification/level`)**:
   - Compute verification levels: `DECLARED`, `OBSERVED`, `CORROBORATED`, `FINANCIALLY_CORROBORATED`.
   - Compute conservative heuristic confidence score (e.g. 0.96 for financially corroborated, 0.72 for unmapped shortfall) and explicit limitation notes.
3. **Pytest Coverage**: Write test cases covering all 4 reconciliation statuses and conflicting evidence edge cases.

# Canonical Scenarios to Implement
- **Scenario 1 (`MATCHED`)**:
  - Expected: ₹30,500 gross - ₹400 kit deduction = ₹30,100 expected net.
  - Actual: ₹30,100 bank settlement credit.
  - Status: `MATCHED`, Level: `FINANCIALLY_CORROBORATED` (Confidence: 0.96).
- **Scenario 2 (`UNEXPLAINED_DIFFERENCE`)**:
  - Expected net payout: ₹30,100.
  - Actual: ₹29,500 bank settlement credit.
  - Shortfall: ₹600.
  - Status: `UNEXPLAINED_DIFFERENCE`, Level: `CORROBORATED` (Confidence: 0.72).
  - Reason: *"Observed platform activity exceeds financially settled amount by INR 600 with no documented deduction record."*

# P1 Tasks
1. Support complex multi-platform payout period aggregation across overlapping date ranges.
2. Add detailed breakdown of authorized platform kit/uniform fee deductions.

# Explicitly Out of Scope
- Black-box machine learning models.
- Direct database management (Owned by Rimjhim).
- Android UI composables (Owned by Sadhana).
- Ed25519 cryptographic signing logic (Owned by Nidhi).

# Dependencies
- Shared domain types (`@onshift/shared-types`).
- Canonical demo dataset (`@onshift/mock-data`).
- Pydantic v2 schemas (`domain.py`).

# Interfaces to Expose
FastAPI HTTP Endpoints on Port 8000:
- `GET /health`
- `POST /reconciliation/run`
- `POST /verification/level`

# Inputs Required
- `ReconciliationRequestSchema`: `workerId`, `payoutPeriod`, `evidenceIds`, `scenarioMode`.
- `VerificationRequestSchema`: `workerId`, `payoutPeriod`, `evidenceIds`.

# Outputs Expected
```json
{
  "status": "UNEXPLAINED_DIFFERENCE",
  "expectedAmount": 30100,
  "actualAmount": 29500,
  "difference": 600,
  "level": "CORROBORATED",
  "confidence": 0.72,
  "reason": "Observed platform activity exceeds financially settled amount by INR 600.",
  "supportingEvidence": ["ev-decl-001", "ev-obs-zomato-001", "ev-obs-swiggy-001", "ev-fin-hdfc-002"],
  "limitations": "Platform-side deduction statement unavailable."
}
```

# Implementation Requirements
- **Rule-Based Only**: Strictly deterministic logic. No black-box AI.
- **Conservative Scoring**: Do not return 100% confidence. Highlight limitations clearly.
- **Explainability**: Every response MUST contain human-readable reasoning text.

# Security Requirements
- Process pseudonymous worker IDs (`OS-DEMO-001`). Do not store or process unhashed raw bank account numbers.

# Testing Requirements
Run `pytest` inside `apps/verification-engine/`:
- Test 1: Perfect match (Scenario 1 ₹30,100 -> `MATCHED`).
- Test 2: Unexplained difference (Scenario 2 ₹600 shortfall: Expected ₹30,100, Actual ₹29,500 -> `UNEXPLAINED_DIFFERENCE`).
- Test 3: Observed-only evidence (`OBSERVED`).
- Test 4: Declared-only evidence (`DECLARED`).

# Demo Requirements
Support deterministic execution of Scenario 1 (₹30,100 matched) and Scenario 2 (₹600 unexplained shortfall: Expected ₹30,100, Actual ₹29,500).

# Failure / Fallback Strategy
If an evidence ID is unrecognized, default status to `INSUFFICIENT_EVIDENCE` with explicit explanation notes.

# Known Risks
Discrepancies in date formatting (ISO 8601 vs local timestamps). Standardize on UTC ISO string parsing.

# Potential Blockers
None. Verification engine is fully self-contained and run via FastAPI/uvicorn.

# Who Depends on This Work
- Member 3 (Rimjhim) proxies backend API calls to this service.
- Member 1 (Sadhana) renders reconciliation and verification results in Android UI.

# What This Person Depends On
- Shared domain object definitions (`packages/shared-types`).

# Handoff Checklist
- `pytest` passes with 100% success.
- `POST /reconciliation/run` returns valid Pydantic response JSON.
- `POST /verification/level` returns valid Pydantic response JSON.

# Definition of Done
1. FastAPI server runs on port 8000.
2. Reconciliation logic handles all 4 statuses deterministically.
3. Verification level logic handles all 4 levels with conservative confidence scoring.
4. Pytest suite passes cleanly.

# Day 1 Goals
Implement and unit test core logic in `reconciliation.py` and `verification.py`.

# Day 2 Goals
Integrate FastAPI endpoints with Express backend proxy requests.

# Day 3 Goals
Add edge-case tests for conflicting evidence and freeze algorithms.

# Final Evaluation Checklist
- [ ] `pytest` passes 100%.
- [ ] `POST /reconciliation/run` returns explainable status.
- [ ] `POST /verification/level` returns conservative confidence score and limitations.
- [ ] Scenarios 1 and 2 produce mathematically verified outputs.
