import {
  OnShiftIncomeCredential,
  CredentialVerificationResult,
  signCredential,
  verifyCredentialSignature,
} from '@onshift/credential-schema';
import { CredentialClaim } from '@onshift/shared-types';
import { config } from '../config';
import { ApiError } from '../middleware/apiError';

/**
 * Issue a signed OnShiftIncomeCredential using Ed25519.
 * Returns the credential-schema's OnShiftIncomeCredential, which carries
 * `type` and `publicKeyHex` instead of the shared-types aliases
 * (`credentialType`, `issuerPublicKey`). The verifier web app and
 * Android client must accept either alias.
 */
export function issueCredential(workerId: string, claims: CredentialClaim): OnShiftIncomeCredential {
  if (!config.ed25519PrivateKeyHex) {
    throw new ApiError(503, 'CREDENTIAL_SIGNING_UNAVAILABLE', 'Credential signing is not configured.');
  }
  return signCredential(
    workerId,
    claims,
    config.ed25519PrivateKeyHex,
    config.ed25519PublicKeyHex,
    config.issuerName
  );
}

/**
 * Verify the Ed25519 signature of an OnShiftIncomeCredential (or any generic credential object).
 * Accepts OnShiftIncomeCredential or any object with signature fields.
 */
export function verifyCredential(credential: OnShiftIncomeCredential | any): CredentialVerificationResult {
  return verifyCredentialSignature(credential as any, {
    issuer: config.trustedIssuer,
    publicKeyHex: config.trustedIssuerPublicKeyHex,
  });
}
