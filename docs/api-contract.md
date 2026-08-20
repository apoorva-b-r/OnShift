# OnShift API Contract

Base URL: `/api/v1`

## Endpoints Summary

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | API and component health check |
| GET | `/workers/:id` | Fetch worker profile |
| POST | `/workers` | Register/create worker pseudonymous profile |
| POST | `/evidence` | Ingest evidence record (Declared, Observed, Financial) |
| GET | `/evidence/worker/:workerId` | List evidence records for worker |
| POST | `/reconciliation/run` | Execute evidence reconciliation pipeline |
| POST | `/verification/level` | Compute verification level and confidence |
| POST | `/credentials/issue` | Issue Ed25519 signed portable credential |
| POST | `/credentials/verify` | Verify signed credential signature and claims |
| GET | `/schemes` | List government schemes |
| POST | `/schemes/match` | Deterministically match worker against schemes |
| POST | `/consent/request` | Request Account Aggregator consent |
| GET | `/consent/status/:consentId` | Check AA consent status |

---

## Endpoint Details

### 1. GET `/health`
- **Response**:
```json
{
  "status": "HEALTHY",
  "version": "1.0.0",
  "timestamp": "2026-08-20T23:24:49.000Z"
}
```

### 2. POST `/reconciliation/run`
- **Request Body**:
```json
{
  "workerId": "OS-DEMO-001",
  "payoutPeriod": {
    "startDate": "2026-08-01",
    "endDate": "2026-08-07"
  },
  "evidenceIds": ["ev-decl-01", "ev-obs-zomato-01", "ev-obs-swiggy-01", "ev-fin-bank-01"]
}
```
- **Response**:
```json
{
  "expectedAmount": 30500,
  "knownDeductions": 400,
  "expectedSettlement": 30100,
  "actualSettlement": 30100,
  "difference": 0,
  "status": "MATCHED",
  "explanation": "Expected payout after known platform deductions matches actual bank settlement exactly.",
  "supportingEvidenceIds": ["ev-decl-01", "ev-obs-zomato-01", "ev-obs-swiggy-01", "ev-fin-bank-01"]
}
```

### 3. POST `/verification/level`
- **Request Body**:
```json
{
  "workerId": "OS-DEMO-001",
  "payoutPeriod": {
    "startDate": "2026-08-01",
    "endDate": "2026-08-07"
  },
  "evidenceIds": ["ev-decl-01", "ev-obs-zomato-01", "ev-obs-swiggy-01", "ev-fin-bank-01"]
}
```
- **Response**:
```json
{
  "level": "FINANCIALLY_CORROBORATED",
  "confidence": 0.96,
  "reason": "Observed platform activity reconciles with payout evidence and corresponding financial settlement.",
  "supportingEvidence": ["ev-decl-01", "ev-obs-zomato-01", "ev-obs-swiggy-01", "ev-fin-bank-01"],
  "limitations": "Confidence represents prototype heuristic scoring."
}
```

### 4. POST `/credentials/issue`
- **Request Body**:
```json
{
  "workerId": "OS-DEMO-001",
  "disclosedClaims": {
    "verifiedIncome": 30100,
    "period": "01 Aug to 07 Aug 2026",
    "verificationLevel": "FINANCIALLY_CORROBORATED"
  }
}
```
- **Response**:
```json
{
  "credential": {
    "credentialType": "OnShiftIncomeCredential",
    "issuer": "OnShift Proof Authority",
    "issuerPublicKey": "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
    "workerId": "OS-DEMO-001",
    "issuedAt": "2026-08-20T23:24:49.000Z",
    "validUntil": "2026-11-20T23:24:49.000Z",
    "claims": {
      "verifiedIncome": 30100,
      "period": "01 Aug to 07 Aug 2026",
      "verificationLevel": "FINANCIALLY_CORROBORATED"
    },
    "signature": "3a8c..."
  }
}
```

### 5. POST `/credentials/verify`
- **Request Body**: (The credential JSON)
- **Response**:
```json
{
  "valid": true,
  "issuerVerified": true,
  "signatureVerified": true,
  "claims": {
    "verifiedIncome": 30100,
    "period": "01 Aug to 07 Aug 2026",
    "verificationLevel": "FINANCIALLY_CORROBORATED"
  },
  "message": "Credential signature is valid and authentic."
}
```
