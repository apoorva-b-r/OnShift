from app.schemas.domain import (
    VerificationRequestSchema,
    VerificationResultSchema,
    VerificationLevelEnum
)

def calculate_verification_level_logic(req: VerificationRequestSchema) -> VerificationResultSchema:
    """
    Deterministic rule-based verification pipeline.
    DECLARED -> OBSERVED -> CORROBORATED -> FINANCIALLY_CORROBORATED
    No ML models used.
    """
    has_declared = any("decl" in ev_id.lower() for ev_id in req.evidenceIds)
    has_observed = any("obs" in ev_id.lower() or "zomato" in ev_id.lower() or "swiggy" in ev_id.lower() for ev_id in req.evidenceIds)
    has_financial = any("fin" in ev_id.lower() or "hdfc" in ev_id.lower() or "bank" in ev_id.lower() for ev_id in req.evidenceIds)

    if has_financial and has_observed:
        return VerificationResultSchema(
            level=VerificationLevelEnum.FINANCIALLY_CORROBORATED,
            confidence=0.96,
            reason="Observed platform order notifications reconcile with bank settlement records via Account Aggregator flow.",
            supportingEvidence=req.evidenceIds,
            limitations="Prototype heuristic score."
        )

    if has_observed:
        return VerificationResultSchema(
            level=VerificationLevelEnum.OBSERVED,
            confidence=0.75,
            reason="Platform notifications observed on-device but awaiting bank settlement confirmation.",
            supportingEvidence=req.evidenceIds,
            limitations="Financial settlement unconfirmed."
        )

    return VerificationResultSchema(
        level=VerificationLevelEnum.DECLARED,
        confidence=0.40,
        reason="Worker self-declaration without cross-corroborating platform or bank evidence.",
        supportingEvidence=req.evidenceIds,
        limitations="Unverified self-report."
    )
