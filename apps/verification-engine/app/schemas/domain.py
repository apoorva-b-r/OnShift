from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum

class ReconciliationStatusEnum(str, Enum):
    MATCHED = "MATCHED"
    EXPLAINED_DIFFERENCE = "EXPLAINED_DIFFERENCE"
    UNEXPLAINED_DIFFERENCE = "UNEXPLAINED_DIFFERENCE"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"

class VerificationLevelEnum(str, Enum):
    DECLARED = "DECLARED"
    OBSERVED = "OBSERVED"
    CORROBORATED = "CORROBORATED"
    FINANCIALLY_CORROBORATED = "FINANCIALLY_CORROBORATED"

class EvidenceRoleEnum(str, Enum):
    ORDER_EVENT = "ORDER_EVENT"
    PAYOUT_CLAIM = "PAYOUT_CLAIM"
    DEDUCTION = "DEDUCTION"
    SETTLEMENT = "SETTLEMENT"

class EvidenceSchema(BaseModel):
    id: str
    workerId: str
    source: str  # DECLARED, OBSERVED, FINANCIAL, OCR
    type: str  # SELF_REPORTED_PAYOUT, NOTIFICATION_PAYOUT, NOTIFICATION_ORDER, AA_BANK_SETTLEMENT, DEDUCTION, PAYOUT_STATEMENT
    category: Optional[str] = "EARNING"  # EARNING, DEDUCTION, SETTLEMENT
    role: Optional[str] = None  # ORDER_EVENT, PAYOUT_CLAIM, DEDUCTION, SETTLEMENT
    platform: str
    timestamp: str
    amount: float
    currency: Optional[str] = "INR"
    reference: Optional[str] = ""
    metadata: Optional[Dict[str, Any]] = None
    capturedAt: Optional[str] = None
    previousHash: Optional[str] = ""
    integrityHash: Optional[str] = ""

    model_config = {
        "allow_inf_nan": False
    }

class PayoutPeriodSchema(BaseModel):
    startDate: str
    endDate: str
    settlementWindowDays: Optional[int] = 3

class ReconciliationRequestSchema(BaseModel):
    workerId: str
    payoutPeriod: PayoutPeriodSchema
    evidenceIds: List[str] = Field(default_factory=list)
    evidences: List[EvidenceSchema] = Field(default_factory=list)
    scenarioMode: Optional[str] = None

class DiscrepancySchema(BaseModel):
    category: str
    expectedAmount: float
    actualAmount: float
    difference: float
    isExplained: bool
    explanationNote: str

class ReconciliationResultSchema(BaseModel):
    expectedAmount: float
    expectedGross: Optional[float] = 0.0
    knownDeductions: float
    expectedSettlement: float
    expectedNet: Optional[float] = 0.0
    actualSettlement: float
    difference: float
    status: ReconciliationStatusEnum
    explanation: str
    supportingEvidenceIds: List[str]
    earningEvidenceIds: Optional[List[str]] = Field(default_factory=list)
    deductionEvidenceIds: Optional[List[str]] = Field(default_factory=list)
    settlementEvidenceIds: Optional[List[str]] = Field(default_factory=list)
    conflictingEvidenceIds: Optional[List[str]] = Field(default_factory=list)
    discrepancyDetails: Optional[List[DiscrepancySchema]] = Field(default_factory=list)
    limitations: Optional[List[str]] = Field(default_factory=list)

class VerificationRequestSchema(BaseModel):
    workerId: str
    payoutPeriod: PayoutPeriodSchema
    evidenceIds: Optional[List[str]] = Field(default_factory=list)
    evidences: Optional[List[EvidenceSchema]] = Field(default_factory=list)

class VerificationResultSchema(BaseModel):
    level: VerificationLevelEnum
    confidence: float
    reason: str
    supportingEvidence: List[str]
    limitations: List[str]
