from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.schemas.domain import (
    ReconciliationRequestSchema,
    ReconciliationResultSchema,
    VerificationRequestSchema,
    VerificationResultSchema
)
from app.services.reconciliation import run_reconciliation_logic
from app.services.verification import calculate_verification_level_logic

app = FastAPI(
    title="OnShift Verification Engine",
    description="Python FastAPI rule-based reconciliation and verification service",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {
        "status": "HEALTHY",
        "service": "OnShift Python Verification Engine",
        "version": "1.0.0"
    }

@app.post("/reconciliation/run", response_model=ReconciliationResultSchema)
def run_reconciliation(req: ReconciliationRequestSchema):
    return run_reconciliation_logic(req)

@app.post("/verification/level", response_model=VerificationResultSchema)
def calculate_verification_level(req: VerificationRequestSchema):
    return calculate_verification_level_logic(req)
