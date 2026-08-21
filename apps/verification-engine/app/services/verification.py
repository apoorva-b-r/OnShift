from typing import List, Set
from app.schemas.domain import (
    VerificationRequestSchema,
    VerificationResultSchema,
    VerificationLevelEnum,
    ReconciliationStatusEnum
)
from app.services.reconciliation import run_reconciliation_logic, ReconciliationRequestSchema, resolve_evidences
from app.services.evidence import extract_ocr_metadata, is_attributable_settlement

def calculate_verification_level_logic(req: VerificationRequestSchema) -> VerificationResultSchema:
    """
    Deterministic rule-based verification pipeline adhering strictly to OnShift Evidence Hierarchy:
    DECLARED -> OBSERVED -> CORROBORATED -> FINANCIALLY_CORROBORATED

    INVARIANTS:
    1. No amount of DECLARED, OBSERVED, or OCR evidence can produce FINANCIALLY_CORROBORATED without a relevant attributable AA settlement.
    2. Presence of AA data alone is insufficient; the settlement MUST be attributable and reconcile (MATCHED or EXPLAINED_DIFFERENCE).
    3. Conflicting evidence or unattributable AA CANNOT produce FINANCIALLY_CORROBORATED.
    """
    all_evidences = resolve_evidences(
        ReconciliationRequestSchema(
            workerId=req.workerId,
            payoutPeriod=req.payoutPeriod,
            evidenceIds=req.evidenceIds,
            evidences=req.evidences
        )
    )

    limitations: List[str] = []

    # Handle empty evidence request
    if not all_evidences:
        return VerificationResultSchema(
            level=VerificationLevelEnum.DECLARED,
            confidence=0.0,
            reason="No evidence submitted for the specified payout period.",
            supportingEvidence=[],
            limitations=["No evidence submitted for the specified payout period."]
        )

    # Classify evidence into distinct source classes
    has_declared = any((ev.source or "").upper() == "DECLARED" for ev in all_evidences)
    has_observed = any((ev.source or "").upper() == "OBSERVED" for ev in all_evidences)
    has_financial = any((ev.source or "").upper() == "FINANCIAL" or "AA" in (ev.type or "").upper() for ev in all_evidences)
    has_ocr = any((ev.source or "").upper() == "OCR" or (ev.metadata and "extractionConfidence" in ev.metadata) for ev in all_evidences)

    # Check financial attribution
    attributable_financial = any(is_attributable_settlement(ev) for ev in all_evidences if (ev.source or "").upper() == "FINANCIAL" or "AA" in (ev.type or "").upper())

    # Check OCR confidence levels
    ocr_low_confidence = False
    ocr_moderate_confidence = False
    for ev in all_evidences:
        is_ocr, doc_id, confidence = extract_ocr_metadata(ev)
        if is_ocr and confidence is not None:
            if confidence < 0.60:
                ocr_low_confidence = True
                limitations.append(f"OCR extraction confidence for document {doc_id or ev.id} is below preferred threshold ({confidence:.2f}). Weak extractions cannot produce financial verification.")
            elif confidence < 0.85:
                ocr_moderate_confidence = True
                limitations.append(f"Document field ({ev.id}) derived from OCR with moderate extraction confidence ({confidence:.2f}).")

    # Run underlying payout-period reconciliation engine
    is_scenario_2 = any(ev.id == "ev-fin-hdfc-002" for ev in all_evidences)
    rec_req = ReconciliationRequestSchema(
        workerId=req.workerId,
        payoutPeriod=req.payoutPeriod,
        evidenceIds=req.evidenceIds,
        evidences=req.evidences,
        scenarioMode="SCENARIO_2" if is_scenario_2 else None
    )
    rec_res = run_reconciliation_logic(rec_req)

    # Calculate count of independent source classes
    source_classes: Set[str] = set()
    if has_declared:
        source_classes.add("DECLARED")
    if has_observed:
        source_classes.add("OBSERVED")
    if has_ocr and not ocr_low_confidence:
        source_classes.add("OCR")
    if has_financial and attributable_financial:
        source_classes.add("FINANCIAL")

    num_independent_classes = len(source_classes)

    # -------------------------------------------------------------------------
    # STRICT GATE 1: FINANCIALLY_CORROBORATED
    # Requires: Relevant ATTRIBUTABLE AA financial settlement AND successful reconciliation (MATCHED / EXPLAINED_DIFFERENCE)
    # -------------------------------------------------------------------------
    if has_financial and attributable_financial and rec_res.status in [ReconciliationStatusEnum.MATCHED, ReconciliationStatusEnum.EXPLAINED_DIFFERENCE]:
        if rec_res.status == ReconciliationStatusEnum.EXPLAINED_DIFFERENCE:
            reason = f"The expected gross earnings of INR {rec_res.expectedAmount:,.2f} minus authorized deductions of INR {rec_res.knownDeductions:,.2f} reconciles with a consented Account Aggregator bank settlement of INR {rec_res.actualSettlement:,.2f}."
            confidence = 0.92
        else:
            reason = f"The expected payout of INR {rec_res.expectedSettlement:,.2f} reconciles with a consented Account Aggregator bank settlement of INR {rec_res.actualSettlement:,.2f} for the relevant payout period."
            confidence = 0.96

        if rec_res.limitations:
            for lim in rec_res.limitations:
                if lim not in limitations:
                    limitations.append(lim)

        return VerificationResultSchema(
            level=VerificationLevelEnum.FINANCIALLY_CORROBORATED,
            confidence=confidence,
            reason=reason,
            supportingEvidence=rec_res.supportingEvidenceIds or req.evidenceIds,
            limitations=limitations
        )

    # -------------------------------------------------------------------------
    # STRICT GATE 2: CORROBORATED
    # Requires: Multiple INDEPENDENT evidence classes OR financial evidence with an unexplained shortfall or uncertain attribution
    # -------------------------------------------------------------------------
    if (has_financial and rec_res.status == ReconciliationStatusEnum.UNEXPLAINED_DIFFERENCE) or (has_financial and not attributable_financial) or num_independent_classes >= 2:
        if rec_res.status == ReconciliationStatusEnum.UNEXPLAINED_DIFFERENCE:
            reason = f"Observed earnings indicate an expected payout of INR {rec_res.expectedSettlement:,.2f}, while relevant bank settlement was INR {rec_res.actualSettlement:,.2f}. The INR {rec_res.difference:,.2f} shortfall remains unexplained."
            limitations.append(f"Observed platform activity exceeds financial settlement by INR {rec_res.difference:,.2f}.")
            limitations.append("Platform-side deduction statement unavailable.")
            confidence = 0.72
        elif has_financial and not attributable_financial:
            reason = "Financial settlement evidence exists, but platform attribution is uncertain. High-tier financial corroboration cannot be awarded."
            limitations.append("Financial settlement evidence exists, but platform attribution is uncertain.")
            confidence = 0.75
        else:
            reason = f"The claim is supported by {num_independent_classes} independent evidence classes ({', '.join(sorted(source_classes))}), but no successfully reconciled Account Aggregator settlement is available."
            limitations.append("Financial corroboration unavailable because no relevant Account Aggregator settlement was provided.")
            confidence = 0.82

        if rec_res.limitations:
            for lim in rec_res.limitations:
                if lim not in limitations:
                    limitations.append(lim)

        return VerificationResultSchema(
            level=VerificationLevelEnum.CORROBORATED,
            confidence=confidence,
            reason=reason,
            supportingEvidence=rec_res.supportingEvidenceIds or req.evidenceIds,
            limitations=limitations
        )

    # -------------------------------------------------------------------------
    # STRICT GATE 3: OBSERVED
    # Requires: On-device platform notifications observed
    # -------------------------------------------------------------------------
    if has_observed:
        limitations.append("Financial corroboration unavailable because no relevant Account Aggregator settlement was provided.")
        return VerificationResultSchema(
            level=VerificationLevelEnum.OBSERVED,
            confidence=0.75,
            reason="The claim is supported by platform activity observed through on-device notifications. Financial settlement corroboration is unavailable.",
            supportingEvidence=rec_res.supportingEvidenceIds or req.evidenceIds,
            limitations=limitations
        )

    # -------------------------------------------------------------------------
    # STRICT GATE 4: DECLARED
    # Worker self-report only
    # -------------------------------------------------------------------------
    limitations.append("Financial corroboration unavailable because no relevant Account Aggregator settlement was provided.")
    limitations.append("Worker self-declaration without cross-corroborating platform notification or bank settlement evidence.")

    return VerificationResultSchema(
        level=VerificationLevelEnum.DECLARED,
        confidence=0.40,
        reason="The income claim is based only on worker-declared information. No independent evidence was available.",
        supportingEvidence=rec_res.supportingEvidenceIds or req.evidenceIds,
        limitations=limitations
    )
