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

class PayoutPeriodSchema(BaseModel):
    startDate: str
    endDate: str

class ReconciliationRequestSchema(BaseModel):
    workerId: str
    payoutPeriod: PayoutPeriodSchema
    evidenceIds: List[str]
    scenarioMode: Optional[str] = "SCENARIO_1"

class DiscrepancySchema(BaseModel):
    category: str
    expectedAmount: float
    actualAmount: float
    difference: float
    isExplained: bool
    explanationNote: str

class ReconciliationResultSchema(BaseModel):
    expectedAmount: float
    knownDeductions: float
    expectedSettlement: float
    actualSettlement: float
    difference: float
    status: ReconciliationStatusEnum
    explanation: str
    supportingEvidenceIds: List[str]
    discrepancyDetails: Optional[List[DiscrepancySchema]] = None

class VerificationRequestSchema(BaseModel):
    workerId: str
    payoutPeriod: PayoutPeriodSchema
    evidenceIds: List[str]

class VerificationResultSchema(BaseModel):
    level: VerificationLevelEnum
    confidence: float
    reason: str
    supportingEvidence: List[str]
    limitations: str
