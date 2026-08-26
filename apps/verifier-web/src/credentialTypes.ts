export interface CredentialClaim {
  verifiedIncome?: number;
  period?: string;
  verificationLevel?: string;
  [key: string]: unknown;
}

export interface OnShiftIncomeCredential {
  type: 'OnShiftIncomeCredential';
  workerId: string;
  issuer: string;
  issuedAt: string;
  validUntil: string;
  claims: CredentialClaim;
  signature: string;
  publicKeyHex: string;
}

export interface CredentialVerificationResult {
  valid: boolean;
  signatureVerified: boolean;
  claims?: CredentialClaim;
  issuer?: string;
  workerId?: string;
  issuedAt?: string;
  validUntil?: string;
  issuerVerified?: boolean;
  message?: string;
}
