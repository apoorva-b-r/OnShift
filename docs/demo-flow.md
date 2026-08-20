# OnShift Hackathon Demo Flow

This document details the deterministic demo flow for the pitch presentation using fictional worker **Ravi Kumar** (ID: `OS-DEMO-001`).

## Canonical Scenario 1: MATCHED & FINANCIALLY CORROBORATED

1. **Identity Setup**
   - Pseudonymous Worker ID: `OS-DEMO-001`
   - Platform activity: Zomato + Swiggy delivery partner.

2. **Evidence Collection**
   - **Declared**: Expected earnings ₹30,500 for week 01 Aug to 07 Aug 2026.
   - **Observed**:
     - Zomato notification capture: ₹18,200 payout notification.
     - Swiggy notification capture: ₹12,300 payout notification.
     - Total observed platform earnings: ₹30,500.
   - **Financial**:
     - Account Aggregator mock flow consent given.
     - Bank deposit transaction fetched: ₹30,100 from GigPlatform Escrow.
   - **Deduction**: ₹400 known platform tech fee and uniform charge.

3. **Reconciliation Engine Execution**
   - Expected Amount: ₹30,500
   - Known Deductions: ₹400
   - Expected Settlement: ₹30,100
   - Actual Settlement: ₹30,100
   - Difference: ₹0
   - Status: **MATCHED**
   - Explanation: Expected payout matches actual bank settlement exactly after accounting for ₹400 uniform deduction.

4. **Verification Engine Pipeline**
   - Level: **FINANCIALLY_CORROBORATED**
   - Confidence: 0.96 (heuristic benchmark)
   - Reason: Platform order activity reconciles with bank settlement evidence.

5. **Selective Disclosure & Cryptographic Signing**
   - Worker checks:
     - [x] Verified Income (₹30,100)
     - [x] Verification Level (FINANCIALLY_CORROBORATED)
     - [ ] Platform Detailed Breakdown (Unchecked)
   - Ed25519 signature generated over selective claims JSON.

6. **Web Verifier Portal Verification**
   - Demo judges paste/upload credential JSON into Verifier React Web App.
   - Signature checks OK: `✓ Ed25519 Signature Valid`, `✓ Issuer Authenticated`.
   - Verified Income ₹30,100 rendered cleanly without disclosing raw transactional history.

7. **Government Scheme Matching**
   - Profile matched deterministically against e-Shram pension and PM-SVANidhi micro-loan scheme.
   - Displays recommendation wording: "You may be eligible".

---

## Alternative Demo Scenario 2: UNEXPLAINED DIFFERENCE

1. **Inputs**:
   - Declared expected: ₹30,500
   - Bank settlement: ₹29,900
   - Known deductions: ₹0
   - Unexplained difference: ₹600

2. **Reconciliation Status**: **UNEXPLAINED_DIFFERENCE**
3. **Verification Level**: **OBSERVED** (Financially uncorroborated due to discrepancy).
4. **Takeaway**: Demonstrates that OnShift transparently highlights discrepancies rather than hiding unverified amounts.
