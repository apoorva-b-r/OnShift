from app.schemas.domain import (
    ReconciliationRequestSchema,
    PayoutPeriodSchema,
    VerificationRequestSchema,
    ReconciliationStatusEnum,
    VerificationLevelEnum,
    EvidenceSchema
)
from app.services.reconciliation import run_reconciliation_logic
from app.services.verification import calculate_verification_level_logic

def test_1_declaration_only():
    req = VerificationRequestSchema(
        workerId="OS-DEMO-001",
        payoutPeriod=PayoutPeriodSchema(startDate="2026-08-01", endDate="2026-08-07"),
        evidenceIds=["ev-decl-001"]
    )
    res = calculate_verification_level_logic(req)
    assert res.level == VerificationLevelEnum.DECLARED
    assert res.confidence == 0.40
    assert any("Financial corroboration unavailable" in lim for lim in res.limitations)

def test_2_observed_only():
    req = VerificationRequestSchema(
        workerId="OS-DEMO-001",
        payoutPeriod=PayoutPeriodSchema(startDate="2026-08-01", endDate="2026-08-07"),
        evidenceIds=["ev-obs-zomato-001"]
    )
    res = calculate_verification_level_logic(req)
    assert res.level == VerificationLevelEnum.OBSERVED
    assert res.confidence == 0.75
    assert res.level != VerificationLevelEnum.FINANCIALLY_CORROBORATED

def test_3_multiple_observed_notifications():
    evidences = [
        EvidenceSchema(
            id="ev-obs-1", workerId="OS-1", source="OBSERVED", type="NOTIFICATION_ORDER",
            category="EARNING", platform="Zomato", timestamp="2026-08-05T12:00:00Z", amount=850.0, reference="REF-Z-101"
        ),
        EvidenceSchema(
            id="ev-obs-2", workerId="OS-1", source="OBSERVED", type="NOTIFICATION_ORDER",
            category="EARNING", platform="Zomato", timestamp="2026-08-05T13:00:00Z", amount=1200.0, reference="REF-Z-102"
        ),
        EvidenceSchema(
            id="ev-obs-3", workerId="OS-1", source="OBSERVED", type="NOTIFICATION_ORDER",
            category="EARNING", platform="Zomato", timestamp="2026-08-05T14:00:00Z", amount=950.0, reference="REF-Z-103"
        ),
    ]
    req = VerificationRequestSchema(
        workerId="OS-1",
        payoutPeriod=PayoutPeriodSchema(startDate="2026-08-01", endDate="2026-08-07"),
        evidences=evidences
    )
    res = calculate_verification_level_logic(req)
    # Multiple notifications from same source class stay OBSERVED
    assert res.level == VerificationLevelEnum.OBSERVED
    assert res.level != VerificationLevelEnum.FINANCIALLY_CORROBORATED
    assert res.level != VerificationLevelEnum.CORROBORATED

def test_4_declared_plus_observed():
    req = VerificationRequestSchema(
        workerId="OS-DEMO-001",
        payoutPeriod=PayoutPeriodSchema(startDate="2026-08-01", endDate="2026-08-07"),
        evidenceIds=["ev-decl-001", "ev-obs-zomato-001"]
    )
    res = calculate_verification_level_logic(req)
    assert res.level == VerificationLevelEnum.CORROBORATED
    assert res.level != VerificationLevelEnum.FINANCIALLY_CORROBORATED

def test_5_declared_plus_observed_plus_ocr():
    evidences = [
        EvidenceSchema(
            id="ev-decl-1", workerId="OS-1", source="DECLARED", type="SELF_REPORTED_PAYOUT",
            category="EARNING", platform="Zomato", timestamp="2026-08-05T12:00:00Z", amount=30100.0
        ),
        EvidenceSchema(
            id="ev-obs-1", workerId="OS-1", source="OBSERVED", type="NOTIFICATION_ORDER",
            category="EARNING", platform="Zomato", timestamp="2026-08-05T12:00:00Z", amount=30100.0
        ),
        EvidenceSchema(
            id="ocr-1", workerId="OS-1", source="OCR", type="NOTIFICATION_ORDER",
            category="EARNING", platform="Zomato", timestamp="2026-08-05T12:00:00Z", amount=30100.0,
            metadata={"sourceDocumentId": "doc-991", "extractionConfidence": 0.91}
        ),
    ]
    req = VerificationRequestSchema(
        workerId="OS-1",
        payoutPeriod=PayoutPeriodSchema(startDate="2026-08-01", endDate="2026-08-07"),
        evidences=evidences
    )
    res = calculate_verification_level_logic(req)
    assert res.level == VerificationLevelEnum.CORROBORATED
    assert res.level != VerificationLevelEnum.FINANCIALLY_CORROBORATED
    assert any("Financial corroboration unavailable" in lim for lim in res.limitations)

def test_6_perfect_aa_reconciliation():
    req = VerificationRequestSchema(
        workerId="OS-DEMO-001",
        payoutPeriod=PayoutPeriodSchema(startDate="2026-08-01", endDate="2026-08-07"),
        evidenceIds=["ev-decl-001", "ev-obs-zomato-001", "ev-obs-swiggy-001", "ev-fin-hdfc-001"]
    )
    res = calculate_verification_level_logic(req)
    assert res.level == VerificationLevelEnum.FINANCIALLY_CORROBORATED
    assert res.confidence == 0.96

def test_7_aa_exists_but_shortfall_exists():
    req = VerificationRequestSchema(
        workerId="OS-DEMO-001",
        payoutPeriod=PayoutPeriodSchema(startDate="2026-08-01", endDate="2026-08-07"),
        evidenceIds=["ev-decl-001", "ev-obs-zomato-001", "ev-obs-swiggy-001", "ev-fin-hdfc-002"]
    )
    res = calculate_verification_level_logic(req)
    assert res.level == VerificationLevelEnum.CORROBORATED
    assert res.confidence == 0.72
    assert res.level != VerificationLevelEnum.FINANCIALLY_CORROBORATED
    assert any("shortfall" in lim.lower() or "exceeds" in lim.lower() for lim in res.limitations)

def test_8_explained_deduction():
    evidences = [
        EvidenceSchema(
            id="ev-obs-1", workerId="OS-1", source="OBSERVED", type="NOTIFICATION_ORDER",
            category="EARNING", platform="Zomato", timestamp="2026-08-05T12:00:00Z", amount=31000.0
        ),
        EvidenceSchema(
            id="ev-ded-1", workerId="OS-1", source="OBSERVED", type="DEDUCTION",
            category="DEDUCTION", platform="Zomato", timestamp="2026-08-05T12:00:00Z", amount=1500.0
        ),
        EvidenceSchema(
            id="ev-fin-1", workerId="OS-1", source="FINANCIAL", type="AA_BANK_SETTLEMENT",
            category="SETTLEMENT", platform="HDFC Bank", timestamp="2026-08-08T10:00:00Z", amount=29500.0
        ),
    ]
    req = VerificationRequestSchema(
        workerId="OS-1",
        payoutPeriod=PayoutPeriodSchema(startDate="2026-08-01", endDate="2026-08-07"),
        evidences=evidences
    )
    res = calculate_verification_level_logic(req)
    assert res.level == VerificationLevelEnum.FINANCIALLY_CORROBORATED
    assert res.confidence == 0.92

def test_9_aa_missing():
    req = VerificationRequestSchema(
        workerId="OS-DEMO-001",
        payoutPeriod=PayoutPeriodSchema(startDate="2026-08-01", endDate="2026-08-07"),
        evidenceIds=["ev-obs-zomato-001", "ev-obs-swiggy-001"]
    )
    res = calculate_verification_level_logic(req)
    assert res.level != VerificationLevelEnum.FINANCIALLY_CORROBORATED
    assert any("Financial corroboration unavailable" in lim for lim in res.limitations)

def test_10_duplicate_notifications():
    evidences = [
        EvidenceSchema(
            id="ev-obs-dup1", workerId="OS-1", source="OBSERVED", type="NOTIFICATION_ORDER",
            category="EARNING", platform="Swiggy", timestamp="2026-08-05T12:00:00Z", amount=500.0, reference="SWIGGY-ORD-101"
        ),
        EvidenceSchema(
            id="ev-obs-dup2", workerId="OS-1", source="OBSERVED", type="NOTIFICATION_ORDER",
            category="EARNING", platform="Swiggy", timestamp="2026-08-05T12:00:00Z", amount=500.0, reference="SWIGGY-ORD-101"
        ),
        EvidenceSchema(
            id="ev-fin-1", workerId="OS-1", source="FINANCIAL", type="AA_BANK_SETTLEMENT",
            category="SETTLEMENT", platform="HDFC Bank", timestamp="2026-08-08T10:00:00Z", amount=500.0
        ),
    ]
    rec_req = ReconciliationRequestSchema(
        workerId="OS-1",
        payoutPeriod=PayoutPeriodSchema(startDate="2026-08-01", endDate="2026-08-07"),
        evidences=evidences
    )
    rec_res = run_reconciliation_logic(rec_req)
    assert rec_res.expectedAmount == 500.0
    assert rec_res.status == ReconciliationStatusEnum.MATCHED

def test_11_two_legitimate_same_value_orders():
    evidences = [
        EvidenceSchema(
            id="ev-obs-1", workerId="OS-1", source="OBSERVED", type="NOTIFICATION_ORDER",
            category="EARNING", platform="Swiggy", timestamp="2026-08-05T12:00:00Z", amount=500.0, reference="SWIGGY-ORD-101"
        ),
        EvidenceSchema(
            id="ev-obs-2", workerId="OS-1", source="OBSERVED", type="NOTIFICATION_ORDER",
            category="EARNING", platform="Swiggy", timestamp="2026-08-05T13:00:00Z", amount=500.0, reference="SWIGGY-ORD-102"
        ),
        EvidenceSchema(
            id="ev-fin-1", workerId="OS-1", source="FINANCIAL", type="AA_BANK_SETTLEMENT",
            category="SETTLEMENT", platform="HDFC Bank", timestamp="2026-08-08T10:00:00Z", amount=1000.0
        ),
    ]
    rec_req = ReconciliationRequestSchema(
        workerId="OS-1",
        payoutPeriod=PayoutPeriodSchema(startDate="2026-08-01", endDate="2026-08-07"),
        evidences=evidences
    )
    rec_res = run_reconciliation_logic(rec_req)
    assert rec_res.expectedAmount == 1000.0
    assert rec_res.status == ReconciliationStatusEnum.MATCHED

def test_12_low_confidence_ocr():
    evidences = [
        EvidenceSchema(
            id="ocr-ev-1", workerId="OS-1", source="OCR", type="NOTIFICATION_ORDER",
            category="EARNING", platform="Zomato", timestamp="2026-08-05T12:00:00Z", amount=15000.0,
            metadata={"sourceDocumentId": "inv-881", "extractionConfidence": 0.45}
        ),
    ]
    req = VerificationRequestSchema(
        workerId="OS-1",
        payoutPeriod=PayoutPeriodSchema(startDate="2026-08-01", endDate="2026-08-07"),
        evidences=evidences
    )
    res = calculate_verification_level_logic(req)
    assert res.level != VerificationLevelEnum.FINANCIALLY_CORROBORATED
    assert any("below preferred threshold" in lim for lim in res.limitations)

def test_13_many_weak_sources_without_aa():
    evidences = [
        EvidenceSchema(id="d1", workerId="OS-1", source="DECLARED", type="SELF_REPORTED_PAYOUT", amount=30100.0, timestamp="2026-08-05T12:00:00Z", platform="Zomato"),
        EvidenceSchema(id="d2", workerId="OS-1", source="DECLARED", type="SELF_REPORTED_PAYOUT", amount=30100.0, timestamp="2026-08-05T12:00:00Z", platform="Zomato"),
        EvidenceSchema(id="o1", workerId="OS-1", source="OBSERVED", type="NOTIFICATION_ORDER", amount=10000.0, timestamp="2026-08-05T12:00:00Z", platform="Zomato", reference="Z1"),
        EvidenceSchema(id="o2", workerId="OS-1", source="OBSERVED", type="NOTIFICATION_ORDER", amount=10000.0, timestamp="2026-08-05T13:00:00Z", platform="Zomato", reference="Z2"),
        EvidenceSchema(id="o3", workerId="OS-1", source="OBSERVED", type="NOTIFICATION_ORDER", amount=10100.0, timestamp="2026-08-05T14:00:00Z", platform="Zomato", reference="Z3"),
        EvidenceSchema(id="ocr1", workerId="OS-1", source="OCR", type="NOTIFICATION_ORDER", amount=30100.0, timestamp="2026-08-05T12:00:00Z", platform="Zomato", metadata={"sourceDocumentId": "doc1", "extractionConfidence": 0.88}),
    ]
    req = VerificationRequestSchema(
        workerId="OS-1",
        payoutPeriod=PayoutPeriodSchema(startDate="2026-08-01", endDate="2026-08-07"),
        evidences=evidences
    )
    res = calculate_verification_level_logic(req)
    # Maximum level is CORROBORATED. NEVER FINANCIALLY_CORROBORATED without AA.
    assert res.level == VerificationLevelEnum.CORROBORATED
    assert res.level != VerificationLevelEnum.FINANCIALLY_CORROBORATED
