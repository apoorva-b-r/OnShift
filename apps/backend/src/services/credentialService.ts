import {
  OnShiftIncomeCredential,
  CredentialVerificationResult,
  signCredential,
  verifyCredentialSignature,
} from '@onshift/credential-schema';
import { CredentialClaim } from '@onshift/shared-types';
import { config } from '../config';

/**
 * Issue a signed OnShiftIncomeCredential using Ed25519.
 * Returns the credential-schema's OnShiftIncomeCredential, which carries
 * `type` and `publicKeyHex` instead of the shared-types aliases
 * (`credentialType`, `issuerPublicKey`). The verifier web app and
 * Android client must accept either alias.
 */
export function issueCredential(workerId: string, claims: CredentialClaim): OnShiftIncomeCredential {
  return signCredential(
    workerId,
    claims,
    config.ed25519PrivateKeyHex,
    config.ed25519PublicKeyHex,
    config.issuerName
  );
}

/**
 * Verify the Ed25519 signature of an OnShiftIncomeCredential.
 * Accepts the credential-schema's native type to avoid field-name
 * mapping errors at the TypeScript level.
 */
export function verifyCredential(credential: OnShiftIncomeCredential): CredentialVerificationResult {
  return verifyCredentialSignature(credential);
}
