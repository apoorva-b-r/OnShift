# OnShift Security & Privacy Architecture

OnShift is designed with a privacy-first, local-first security architecture.

## 1. Terminology & Standards

- **Tamper-Evident Records**: OnShift implements sequential SHA-256 hash chaining where each evidence record includes the hash of the preceding record (`currentHash = SHA256(data + previousHash)`). This provides local tamper detection.
- **Cryptographic Credentials**: Selective disclosure claims are signed using standard Ed25519 digital signature keys.
- **Selective Disclosure**: Workers explicitly toggle which verified attributes are included in exported credentials.

## 2. Privacy & Data Minimization

- **Pseudonymous Worker IDs**: Backend services identify workers using generated identifiers (e.g. `OS-DEMO-001`).
- **Local-First Evidence Storage**: Raw notifications and Account Aggregator transaction details are processed on-device and stored in an encrypted local vault.
- **Zero Raw PII Exposure**: Backend logs and verification engines process metadata, aggregated figures, and evidence hashes without storing full raw bank statements or personal identity numbers.

## 3. Threat Model & Mitigations

| Threat | Mitigation |
|---|---|
| User modifies local evidence database | Hash chain integrity check fails (`verifyHashChain` returns `brokenAt`). |
| Fake credential issued by third-party | Verifier checks Ed25519 signature against official OnShift public key. |
| Over-exposure of financial transactions | Selective disclosure presents only high-level verified income figures. |
| Compromised API keys | Environment variables used; no secrets committed to repository. |

## 4. Key Management

- Android local vault uses Android Keystore / EncryptedSharedPreferences.
- Cryptographic keys in `.env.example` are strictly marked as DEVELOPMENT ONLY.
