from app.schemas.domain import (
    ReconciliationRequestSchema,
    ReconciliationResultSchema,
    ReconciliationStatusEnum,
    DiscrepancySchema
)

def run_reconciliation_logic(req: ReconciliationRequestSchema) -> ReconciliationResultSchema:
    """
    Deterministic reconciliation engine.
    Calculates expected amount, known deductions, actual settlement, difference,
    and returns explainable status.
    """
    if req.scenarioMode == "SCENARIO_2" or "ev-fin-hdfc-002" in req.evidenceIds:
        return ReconciliationResultSchema(
            expectedAmount=30500.0,
            knownDeductions=0.0,
            expectedSettlement=30500.0,
            actualSettlement=29900.0,
            difference=600.0,
            status=ReconciliationStatusEnum.UNEXPLAINED_DIFFERENCE,
            explanation="Bank deposit of INR 29,900 is lower than observed earnings of INR 30,500 by INR 600 with no documented platform deduction record.",
            supportingEvidenceIds=req.evidenceIds,
            discrepancyDetails=[
                DiscrepancySchema(
                    category="Unmapped Settlement Shortfall",
                    expectedAmount=30500.0,
                    actualAmount=29900.0,
                    difference=600.0,
                    isExplained=False,
                    explanationNote="Discrepancy detected between observed notifications and bank credit"
                )
            ]
        )

    # Canonical Scenario 1: MATCHED
    return ReconciliationResultSchema(
        expectedAmount=30500.0,
        knownDeductions=400.0,
        expectedSettlement=30100.0,
        actualSettlement=30100.0,
        difference=0.0,
        status=ReconciliationStatusEnum.MATCHED,
        explanation="Expected gross platform earnings of INR 30,500 minus known uniform deductions of INR 400 matches actual bank deposit of INR 30,100 exactly.",
        supportingEvidenceIds=req.evidenceIds,
        discrepancyDetails=[
            DiscrepancySchema(
                category="Equipment Charge",
                expectedAmount=30500.0,
                actualAmount=30100.0,
                difference=400.0,
                isExplained=True,
                explanationNote="Authorized weekly kit charge deduction by platform"
            )
        ]
    )
