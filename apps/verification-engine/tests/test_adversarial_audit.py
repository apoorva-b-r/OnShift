import pytest
import math
import copy
import time
from typing import List
from pydantic import ValidationError
from fastapi.testclient import TestClient

from app.main import app
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

DEFAULT_PERIOD = PayoutPeriodSchema(startDate="2026-08-01", endDate="2026-08-07", settlementWindowDays=3)
client = TestClient(app)

# -----------------------------------------------------------------------------
# TEST GROUP 1: TIMEZONE AND PERIOD BOUNDARIES
# -----------------------------------------------------------------------------

def test_1a_timezone_inside_period():
    # 2026-08-07T23:59:59Z is inside period (ends Aug 7 23:59:59.999Z)
    evidences = [
        EvidenceSchema(id="t1a", workerId="OS-1", source="OBSERVED", type="NOTIFICATION_ORDER", amount=5000.0, timestamp="2026-08-07T23:59:59Z", platform="Zomato")
    ]
    rec_res = run_reconciliation_logic(ReconciliationRequestSchema(workerId="OS-1", payoutPeriod=DEFAULT_PERIOD, evidences=evidences))
    assert rec_res.expectedAmount == 5000.0

def test_1b_timezone_outside_period():
    # 2026-08-08T00:00:01Z is outside period
    evidences = [
        EvidenceSchema(id="t1b", workerId="OS-1", source="OBSERVED", type="NOTIFICATION_ORDER", amount=5000.0, timestamp="2026-08-08T00:00:01Z", platform="Zomato")
    ]
    rec_res = run_reconciliation_logic(ReconciliationRequestSchema(workerId="OS-1", payoutPeriod=DEFAULT_PERIOD, evidences=evidences))
    assert rec_res.expectedAmount == 0.0

def test_1c_equivalent_utc_inside_period():
    # 2026-08-07T23:59:59+00:00 is inside period
    evidences = [
        EvidenceSchema(id="t1c", workerId="OS-1", source="OBSERVED", type="NOTIFICATION_ORDER", amount=5000.0, timestamp="2026-08-07T23:59:59+00:00", platform="Zomato")
    ]
    rec_res = run_reconciliation_logic(ReconciliationRequestSchema(workerId="OS-1", payoutPeriod=DEFAULT_PERIOD, evidences=evidences))
    assert rec_res.expectedAmount == 5000.0

def test_1d_equivalent_utc_outside_period():
    # 2026-08-08T00:00:01+00:00 is outside period
    evidences = [
        EvidenceSchema(id="t1d", workerId="OS-1", source="OBSERVED", type="NOTIFICATION_ORDER", amount=5000.0, timestamp="2026-08-08T00:00:01+00:00", platform="Zomato")
    ]
    rec_res = run_reconciliation_logic(ReconciliationRequestSchema(workerId="OS-1", payoutPeriod=DEFAULT_PERIOD, evidences=evidences))
    assert rec_res.expectedAmount == 0.0

def test_1e_settlement_window_exact_boundary():
    # Period ends Aug 7 23:59:59Z. +3 days window = Aug 10 23:59:59Z
    ev_eligible = [
        EvidenceSchema(id="o1", workerId="OS-1", source="OBSERVED", type="NOTIFICATION_ORDER", amount=10000.0, timestamp="2026-08-05T12:00:00Z", platform="Zomato"),
        EvidenceSchema(id="f1", workerId="OS-1", source="FINANCIAL", type="AA_BANK_SETTLEMENT", category="SETTLEMENT", amount=10000.0, timestamp="2026-08-10T23:59:59Z", platform="HDFC Bank", metadata={"remitter": "Gig Platform Escrow"}),
    ]
    rec_eligible = run_reconciliation_logic(ReconciliationRequestSchema(workerId="OS-1", payoutPeriod=DEFAULT_PERIOD, evidences=ev_eligible))
    assert rec_eligible.actualSettlement == 10000.0

    ev_ineligible = [
        EvidenceSchema(id="o1", workerId="OS-1", source="OBSERVED", type="NOTIFICATION_ORDER", amount=10000.0, timestamp="2026-08-05T12:00:00Z", platform="Zomato"),
        EvidenceSchema(id="f1", workerId="OS-1", source="FINANCIAL", type="AA_BANK_SETTLEMENT", category="SETTLEMENT", amount=10000.0, timestamp="2026-08-11T00:00:01Z", platform="HDFC Bank", metadata={"remitter": "Gig Platform Escrow"}),
    ]
    rec_ineligible = run_reconciliation_logic(ReconciliationRequestSchema(workerId="OS-1", payoutPeriod=DEFAULT_PERIOD, evidences=ev_ineligible))
    assert rec_ineligible.actualSettlement == 0.0

# -----------------------------------------------------------------------------
# TEST GROUP 2: FASTAPI BOUNDARY & MALFORMED INPUT
# -----------------------------------------------------------------------------

def test_2a_fastapi_health_check():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "HEALTHY"

def test_2b_fastapi_empty_object():
    res = client.post("/reconciliation/run", json={})
    assert res.status_code == 422  # Missing required workerId and payoutPeriod

def test_2c_fastapi_null_evidences():
    res = client.post("/reconciliation/run", json={"workerId": "OS-1", "payoutPeriod": {"startDate": "2026-08-01", "endDate": "2026-08-07"}, "evidences": None})
    assert res.status_code == 422

def test_2d_fastapi_currency_string_amount():
    payload = {
        "workerId": "OS-1",
        "payoutPeriod": {"startDate": "2026-08-01", "endDate": "2026-08-07"},
        "evidences": [{"id": "e1", "workerId": "OS-1", "source": "DECLARED", "type": "SELF_REPORTED_PAYOUT", "platform": "Zomato", "timestamp": "2026-08-05T12:00:00Z", "amount": "₹30,100"}]
    }
    res = client.post("/reconciliation/run", json=payload)
    assert res.status_code == 422

def test_2e_fastapi_malformed_timestamp():
    payload = {
        "workerId": "OS-1",
        "payoutPeriod": {"startDate": "2026-08-01", "endDate": "2026-08-07"},
        "evidences": [{"id": "e1", "workerId": "OS-1", "source": "DECLARED", "type": "SELF_REPORTED_PAYOUT", "platform": "Zomato", "timestamp": "yesterday", "amount": 30100.0}]
    }
    res = client.post("/reconciliation/run", json=payload)
    assert res.status_code == 200
    # Malformed timestamp is filtered out safely by period check
    assert res.json()["status"] == "INSUFFICIENT_EVIDENCE"

def test_2f_nan_and_infinity_rejection():
    with pytest.raises(ValidationError):
        EvidenceSchema(id="e-nan", workerId="OS-1", source="OBSERVED", type="NOTIFICATION_ORDER", amount=math.nan, timestamp="2026-08-05T12:00:00Z", platform="Zomato")

# -----------------------------------------------------------------------------
# TEST GROUP 3: MULTI-PLATFORM SCOPING
# -----------------------------------------------------------------------------

def test_3a_multi_platform_partial_aa_settlement():
    evidences = [
        EvidenceSchema(id="o-zomato", workerId="OS-1", source="OBSERVED", type="NOTIFICATION_ORDER", amount=15000.0, timestamp="2026-08-05T12:00:00Z", platform="Zomato", reference="Z1"),
        EvidenceSchema(id="o-swiggy", workerId="OS-1", source="OBSERVED", type="NOTIFICATION_ORDER", amount=10000.0, timestamp="2026-08-05T12:00:00Z", platform="Swiggy", reference="S1"),
        EvidenceSchema(id="o-uber", workerId="OS-1", source="OBSERVED", type="NOTIFICATION_ORDER", amount=5000.0, timestamp="2026-08-05T12:00:00Z", platform="Uber", reference="U1"),
        # AA settlement covers ONLY Zomato ₹15,000
        EvidenceSchema(id="f-zomato", workerId="OS-1", source="FINANCIAL", type="AA_BANK_SETTLEMENT", category="SETTLEMENT", amount=15000.0, timestamp="2026-08-08T12:00:00Z", platform="HDFC Bank", metadata={"remitter": "Zomato Escrow"}),
    ]
    req = VerificationRequestSchema(workerId="OS-1", payoutPeriod=DEFAULT_PERIOD, evidences=evidences)
    res = calculate_verification_level_logic(req)
    # Total expected = 30,000, Actual AA = 15,000 -> Shortfall of 15,000! MUST NOT BE FINANCIALLY_CORROBORATED
    assert res.level == VerificationLevelEnum.CORROBORATED
    assert res.level != VerificationLevelEnum.FINANCIALLY_CORROBORATED
    assert any("Observed platform activity exceeds financial settlement" in lim for lim in res.limitations)

# -----------------------------------------------------------------------------
# TEST GROUP 4: EVIDENCE VOLUME & PERFORMANCE
# -----------------------------------------------------------------------------

@pytest.mark.parametrize("record_count", [10, 100, 1000, 10000])
def test_4a_volume_correctness_and_performance(record_count):
    evidences = [
        EvidenceSchema(
            id=f"ev-vol-{i}", workerId="OS-VOL", source="OBSERVED", type="NOTIFICATION_ORDER",
            category="EARNING", platform="Zomato", timestamp="2026-08-05T12:00:00Z", amount=500.0, reference=f"REF-VOL-{i}"
        ) for i in range(record_count)
    ]
    t0 = time.time()
    rec_res = run_reconciliation_logic(ReconciliationRequestSchema(workerId="OS-VOL", payoutPeriod=DEFAULT_PERIOD, evidences=evidences))
    t1 = time.time()
    elapsed = t1 - t0

    assert rec_res.expectedAmount == record_count * 500.0
    assert elapsed < 2.0  # Must run within 2 seconds

# -----------------------------------------------------------------------------
# TEST GROUP 5: CONFLICTING SOURCES
# -----------------------------------------------------------------------------

def test_5a_conflicting_sources_no_summation():
    evidences = [
        EvidenceSchema(id="o1", workerId="OS-1", source="OBSERVED", type="NOTIFICATION_PAYOUT", role="PAYOUT_CLAIM", amount=30100.0, timestamp="2026-08-05T12:00:00Z", platform="Zomato"),
        EvidenceSchema(id="ocr1", workerId="OS-1", source="OCR", type="PAYOUT_STATEMENT", role="PAYOUT_CLAIM", amount=31000.0, timestamp="2026-08-05T12:00:00Z", platform="Zomato", metadata={"sourceDocumentId": "doc1", "extractionConfidence": 0.95}),
        EvidenceSchema(id="d1", workerId="OS-1", source="DECLARED", type="SELF_REPORTED_PAYOUT", role="PAYOUT_CLAIM", amount=29500.0, timestamp="2026-08-05T12:00:00Z", platform="Zomato"),
    ]
    rec_res = run_reconciliation_logic(ReconciliationRequestSchema(workerId="OS-1", payoutPeriod=DEFAULT_PERIOD, evidences=evidences))
    # Engine MUST NOT sum ₹30,100 + ₹31,000 + ₹29,500 = ₹90,600!
    assert rec_res.expectedAmount != 90600.0
    assert rec_res.expectedAmount == 30100.0
    assert len(rec_res.conflictingEvidenceIds) > 0

# -----------------------------------------------------------------------------
# TEST GROUP 6: AA ATTRIBUTION ATTACK
# -----------------------------------------------------------------------------

def test_6a_aa_attribution_friend_transfer_rejected():
    evidences = [
        EvidenceSchema(id="o1", workerId="OS-1", source="OBSERVED", type="NOTIFICATION_PAYOUT", amount=30100.0, timestamp="2026-08-05T12:00:00Z", platform="Zomato"),
        EvidenceSchema(id="f1", workerId="OS-1", source="FINANCIAL", type="AA_BANK_SETTLEMENT", category="SETTLEMENT", amount=30100.0, timestamp="2026-08-08T12:00:00Z", platform="HDFC Bank", metadata={"remitter": "Apoorva's friend"}),
    ]
    req = VerificationRequestSchema(workerId="OS-1", payoutPeriod=DEFAULT_PERIOD, evidences=evidences)
    res = calculate_verification_level_logic(req)
    assert res.level != VerificationLevelEnum.FINANCIALLY_CORROBORATED

def test_6b_aa_attribution_legitimate_remitter_accepted():
    evidences = [
        EvidenceSchema(id="o1", workerId="OS-1", source="OBSERVED", type="NOTIFICATION_PAYOUT", amount=30100.0, timestamp="2026-08-05T12:00:00Z", platform="Zomato"),
        EvidenceSchema(id="f1", workerId="OS-1", source="FINANCIAL", type="AA_BANK_SETTLEMENT", category="SETTLEMENT", amount=30100.0, timestamp="2026-08-08T12:00:00Z", platform="HDFC Bank", metadata={"remitter": "Zomato Payments Private Limited"}),
    ]
    req = VerificationRequestSchema(workerId="OS-1", payoutPeriod=DEFAULT_PERIOD, evidences=evidences)
    res = calculate_verification_level_logic(req)
    assert res.level == VerificationLevelEnum.FINANCIALLY_CORROBORATED

# -----------------------------------------------------------------------------
# TEST GROUP 13: ROUNDING & MONEY PRECISION
# -----------------------------------------------------------------------------

def test_13a_floating_point_precision():
    evidences = [
        EvidenceSchema(id="o1", workerId="OS-1", source="OBSERVED", type="NOTIFICATION_ORDER", amount=100.10, timestamp="2026-08-05T12:00:00Z", platform="Zomato", reference="R1"),
        EvidenceSchema(id="o2", workerId="OS-1", source="OBSERVED", type="NOTIFICATION_ORDER", amount=200.20, timestamp="2026-08-05T12:00:00Z", platform="Zomato", reference="R2"),
        EvidenceSchema(id="o3", workerId="OS-1", source="OBSERVED", type="NOTIFICATION_ORDER", amount=300.30, timestamp="2026-08-05T12:00:00Z", platform="Zomato", reference="R3"),
        EvidenceSchema(id="f1", workerId="OS-1", source="FINANCIAL", type="AA_BANK_SETTLEMENT", category="SETTLEMENT", amount=600.60, timestamp="2026-08-08T12:00:00Z", platform="HDFC Bank", metadata={"remitter": "Zomato Escrow"}),
    ]
    rec_res = run_reconciliation_logic(ReconciliationRequestSchema(workerId="OS-1", payoutPeriod=DEFAULT_PERIOD, evidences=evidences))
    assert rec_res.expectedAmount == 600.60
    assert rec_res.difference == 0.0
    assert rec_res.status == ReconciliationStatusEnum.MATCHED

# -----------------------------------------------------------------------------
# TEST GROUP 14: OUT-OF-ORDER EVIDENCE PERMUTATIONS
# -----------------------------------------------------------------------------

def test_14a_out_of_order_evidence_determinism():
    ev1 = EvidenceSchema(id="d1", workerId="OS-1", source="DECLARED", type="SELF_REPORTED_PAYOUT", amount=30100.0, timestamp="2026-08-05T12:00:00Z", platform="Zomato")
    ev2 = EvidenceSchema(id="o1", workerId="OS-1", source="OBSERVED", type="NOTIFICATION_PAYOUT", amount=30100.0, timestamp="2026-08-05T12:00:00Z", platform="Zomato")
    ev3 = EvidenceSchema(id="f1", workerId="OS-1", source="FINANCIAL", type="AA_BANK_SETTLEMENT", category="SETTLEMENT", amount=30100.0, timestamp="2026-08-08T12:00:00Z", platform="HDFC Bank", metadata={"remitter": "Zomato Escrow"})

    res_order_1 = run_reconciliation_logic(ReconciliationRequestSchema(workerId="OS-1", payoutPeriod=DEFAULT_PERIOD, evidences=[ev1, ev2, ev3]))
    res_order_2 = run_reconciliation_logic(ReconciliationRequestSchema(workerId="OS-1", payoutPeriod=DEFAULT_PERIOD, evidences=[ev3, ev1, ev2]))
    res_order_3 = run_reconciliation_logic(ReconciliationRequestSchema(workerId="OS-1", payoutPeriod=DEFAULT_PERIOD, evidences=[ev2, ev3, ev1]))

    assert res_order_1.expectedAmount == res_order_2.expectedAmount == res_order_3.expectedAmount
    assert res_order_1.status == res_order_2.status == res_order_3.status == ReconciliationStatusEnum.MATCHED

# -----------------------------------------------------------------------------
# TEST GROUP 17: FASTAPI API RESPONSE SCHEMA CONTRACT
# -----------------------------------------------------------------------------

def test_17a_api_response_schema_contract():
    payload = {
        "workerId": "OS-API-TEST",
        "payoutPeriod": {"startDate": "2026-08-01", "endDate": "2026-08-07"},
        "evidences": [
            {"id": "api-obs", "workerId": "OS-API-TEST", "source": "OBSERVED", "type": "NOTIFICATION_PAYOUT", "platform": "Zomato", "timestamp": "2026-08-05T12:00:00Z", "amount": 30100.0},
            {"id": "api-fin", "workerId": "OS-API-TEST", "source": "FINANCIAL", "type": "AA_BANK_SETTLEMENT", "category": "SETTLEMENT", "platform": "HDFC Bank", "timestamp": "2026-08-08T12:00:00Z", "amount": 30100.0, "metadata": {"remitter": "Zomato Escrow"}}
        ]
    }
    res = client.post("/reconciliation/run", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "expectedAmount" in data
    assert "expectedGross" in data
    assert "knownDeductions" in data
    assert "expectedNet" in data
    assert "actualSettlement" in data
    assert "difference" in data
    assert "status" in data
    assert "explanation" in data
    assert "earningEvidenceIds" in data
    assert "deductionEvidenceIds" in data
    assert "settlementEvidenceIds" in data
    assert "supportingEvidenceIds" in data
    assert "limitations" in data

# -----------------------------------------------------------------------------
# TEST GROUP 18: IMMUTABILITY & INPUT MUTATION SAFETY
# -----------------------------------------------------------------------------

def test_18a_input_immutability():
    original_evidences = [
        EvidenceSchema(id="imm-1", workerId="OS-1", source="OBSERVED", type="NOTIFICATION_ORDER", amount=500.0, timestamp="2026-08-05T12:00:00Z", platform="Zomato", reference="REF-IMM-1")
    ]
    cloned = copy.deepcopy(original_evidences)
    req = ReconciliationRequestSchema(workerId="OS-1", payoutPeriod=DEFAULT_PERIOD, evidences=original_evidences)
    _ = run_reconciliation_logic(req)

    assert original_evidences == cloned
