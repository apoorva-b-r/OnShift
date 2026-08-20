from app.schemas.domain import (
    ReconciliationRequestSchema,
    PayoutPeriodSchema,
    VerificationRequestSchema,
    ReconciliationStatusEnum,
    VerificationLevelEnum
)
from app.services.reconciliation import run_reconciliation_logic
from app.services.verification import calculate_verification_level_logic

def test_reconciliation_matched():
    req = ReconciliationRequestSchema(
        workerId="OS-DEMO-001",
        payoutPeriod=PayoutPeriodSchema(startDate="2026-08-01", endDate="2026-08-07"),
        evidenceIds=["ev-decl-001", "ev-obs-zomato-001", "ev-obs-swiggy-001", "ev-fin-hdfc-001"],
        scenarioMode="SCENARIO_1"
    )
    res = run_reconciliation_logic(req)
    assert res.status == ReconciliationStatusEnum.MATCHED
    assert res.expectedSettlement == 30100.0
    assert res.actualSettlement == 30100.0
    assert res.difference == 0.0

def test_reconciliation_unexplained_difference():
    req = ReconciliationRequestSchema(
        workerId="OS-DEMO-001",
        payoutPeriod=PayoutPeriodSchema(startDate="2026-08-01", endDate="2026-08-07"),
        evidenceIds=["ev-decl-001", "ev-obs-zomato-001", "ev-obs-swiggy-001", "ev-fin-hdfc-002"],
        scenarioMode="SCENARIO_2"
    )
    res = run_reconciliation_logic(req)
    assert res.status == ReconciliationStatusEnum.UNEXPLAINED_DIFFERENCE
    assert res.difference == 600.0

def test_verification_financially_corroborated():
    req = VerificationRequestSchema(
        workerId="OS-DEMO-001",
        payoutPeriod=PayoutPeriodSchema(startDate="2026-08-01", endDate="2026-08-07"),
        evidenceIds=["ev-decl-001", "ev-obs-zomato-001", "ev-fin-hdfc-001"]
    )
    res = calculate_verification_level_logic(req)
    assert res.level == VerificationLevelEnum.FINANCIALLY_CORROBORATED
    assert res.confidence == 0.96
