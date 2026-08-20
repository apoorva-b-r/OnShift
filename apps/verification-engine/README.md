# OnShift Verification Engine

Python 3 FastAPI service for rule-based income reconciliation and evidence verification level computation.

## Core Services
- `POST /reconciliation/run`: Explainable financial reconciliation (MATCHED, EXPLAINED_DIFFERENCE, UNEXPLAINED_DIFFERENCE, INSUFFICIENT_EVIDENCE).
- `POST /verification/level`: Deterministic verification level calculator (DECLARED -> OBSERVED -> CORROBORATED -> FINANCIALLY_CORROBORATED).

## Commands
```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
pytest
```
