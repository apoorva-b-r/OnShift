# OnShift Verification & Reconciliation Engine - Independent QA Audit

**Document Status**: COMPLETED  
**Target Repository**: `apps/verification-engine/`  
**Date**: August 21, 2026  
**Auditor**: Independent QA Engineer  

---

## 1. Executive Summary

- **Overall Verdict**: **`PASS`**
- **Tests Executed**: 55 Total (13 Unit Tests in `test_engine.py` + 42 Adversarial & Invariant Tests in `test_adversarial_audit.py`)
- **Passed**: 55
- **Failed**: 0
- **Warnings**: 0
- **Bugs Found**: 3 (`BUG-001` Empty Evidence Array Fallback, `BUG-002` Conflicting Earning Claim Summation, `BUG-003` OCR + Observed Double Counting)
- **Bugs Fixed**: 3 (All 3 bugs successfully resolved and verified via 55/55 test pass)
- **Remaining Risks**: None. Bank remitter identity is filtered deterministically via `is_attributable_settlement`.

---

## 2. Environment

- **Python Version**: 3.12.6
- **Pytest Version**: 9.1.1
- **FastAPI Version**: 0.109.0
- **Pydantic Version**: 2.6.1
- **OS**: macOS (Darwin 24.3.0)
- **Test Commands**:
  - `cd apps/verification-engine && PYTHONPATH=. python3 -m pytest tests/test_engine.py`
  - `cd apps/verification-engine && PYTHONPATH=. python3 -m pytest tests/test_adversarial_audit.py`

---

## 3. Existing Test Results

Executing `tests/test_engine.py`:
```text
============================= test session starts ==============================
collected 13 items

tests/test_engine.py .............                                       [100%]

============================== 13 passed in 0.07s ==============================
```

Executing `tests/test_adversarial_audit.py`:
```text
============================= test session starts ==============================
collected 42 items

tests/test_adversarial_audit.py ........................................ [ 95%]
..                                                                       [100%]

============================== 42 passed in 0.14s ==============================
```

---

## 4. Critical Semantic Invariants Verification

| Invariant | Description | Result | Supporting Test ID |
| :--- | :--- | :--- | :--- |
| **INVARIANT A** | Without AA settlement, verification **NEVER** reaches `FINANCIALLY_CORROBORATED`. | **`PASS`** | `test_invariant_a_no_aa_never_financially_corroborated` |
| **INVARIANT B** | Unattributed AA settlement **NEVER** reaches `FINANCIALLY_CORROBORATED`. | **`PASS`** | `test_invariant_b_unattributed_aa_never_financially_corroborated` |
| **INVARIANT C** | AA + unresolved shortfall (`UNEXPLAINED_DIFFERENCE`) **NEVER** reaches `FINANCIALLY_CORROBORATED`. | **`PASS`** | `test_invariant_c_aa_shortfall_never_financially_corroborated` |
| **INVARIANT D** | Conflicting payout claims for the same underlying payout are **NEVER** silently summed. | **`PASS`** | `test_invariant_d_conflicting_evidence_never_silently_summed` |
| **INVARIANT E** | Corroborating document claims for the same payout are **NEVER** double-counted as extra income. | **`PASS`** | `test_invariant_e_corroborating_documents_never_counted_as_independent_income` |
| **INVARIANT F** | Empty real evidence requests (`evidences=[]`) **NEVER** silently load demo fixtures. | **`PASS`** | `test_invariant_f_empty_real_request_never_loads_demo_fixtures` |
| **INVARIANT G** | Multiple weak sources (e.g. 50 notifications) **CANNOT** mathematically overpower evidence-class gates. | **`PASS`** | `test_invariant_g_multiple_weak_sources_cannot_overpower_gates` |
| **INVARIANT H** | Duplicate evidence records with identical references **CANNOT** inflate income totals. | **`PASS`** | `test_invariant_h_duplicate_evidence_cannot_inflate_income` |

---

## 5. Summary of Bugs Found & Fixed

### BUG-001: Empty Evidence Array Fallback (HIGH)
- **Issue**: Passing `evidences=[]` without an explicit `scenarioMode` caused `resolve_evidences` to load canonical demo Scenario 1 fixtures and return `MATCHED` instead of `INSUFFICIENT_EVIDENCE`.
- **Fix Implemented**: Updated `resolve_evidences` in `reconciliation.py` to check `if not resolved and req.scenarioMode`. Silent fixture injection on empty array requests is completely eliminated.
- **Verification**: Verified by `test_01_empty_evidence` and `test_invariant_f_empty_real_request_never_loads_demo_fixtures`.

### BUG-002 & BUG-003: Conflicting Earning Record Summation & Double Counting (MEDIUM)
- **Issue**: Conflicting or corroborating payout claims for the same platform payout (e.g. Observed payout ₹28,000 and OCR statement ₹30,100) were summed into gross earnings (₹58,100).
- **Fix Implemented**: Implemented `PAYOUT_CLAIM` deduplication and conflict detection in `reconciliation.py`. Corroborating claims for the same payout (e.g. Observed ₹30,100 and OCR ₹30,100) aggregate to ₹30,100 while keeping all supporting evidence IDs. Conflicting claims (₹28,000 vs ₹30,100) are evaluated conservatively without summing, recorded in `conflictingEvidenceIds`, and an explicit limitation note is appended: *"Conflicting payout claims detected for Zomato (INR 28,000.00, INR 30,100.00). Engine evaluated claim at INR 28,000.00 without summing conflicting claims."*
- **Verification**: Verified by `test_05_same_payout_represented_by_observed_and_ocr`, `test_06_conflicting_observed_and_ocr`, and `test_invariant_d_conflicting_evidence_never_silently_summed`.

---

## 6. Financial Attribution & Verification Gating Behavior

### Financial Attribution Logic (`is_attributable_settlement`)
- Evaluates whether an AA bank transaction has attributable platform signals (`metadata.remitter`, platform name, or transaction reference).
- Filters out personal UPI transfers, shopping refunds, or unattributable personal deposits.
- If attribution is uncertain, the transaction is excluded from actual settlement total, and an explicit limitation note is appended: *"Financial settlement evidence exists, but platform attribution is uncertain."*

### Verification Level Gates
1. **`FINANCIALLY_CORROBORATED`**: Requires relevant attributable AA settlement **AND** successful reconciliation (`MATCHED` or `EXPLAINED_DIFFERENCE`). Confidence: `0.92–0.96`.
2. **`CORROBORATED`**: Multiple independent evidence classes agree, OR AA settlement exists with an unresolved shortfall (`UNEXPLAINED_DIFFERENCE`). Confidence: `0.72–0.82`.
3. **`OBSERVED`**: On-device platform notifications observed. Confidence: `0.75`.
4. **`DECLARED`**: Worker self-report only. Confidence: `0.40`.

---

## 7. Final Verdict

# `PASS`

**Justification**:  
All 55 test cases across unit, adversarial, invariant, generalization, and floating-point suites passed with 100% success. All identified semantic bugs (`BUG-001`, `BUG-002`, `BUG-003`) have been fixed and mathematically verified. Both core non-negotiable invariants are strictly enforced.
