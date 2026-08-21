import { Credential, CredentialClaim, CredentialVerificationResult } from '@onshift/shared-types';
import { signCredential, verifyCredentialSignature } from '@onshift/credential-schema';
import { config } from '../config';

export function issueCredential(workerId: string, claims: CredentialClaim): Credential {
  return signCredential(
    workerId,
    claims,
    config.ed25519PrivateKeyHex,
    config.ed25519PublicKeyHex,
    config.issuerName
  );
}

export function verifyCredential(credential: Credential): CredentialVerificationResult {
  return verifyCredentialSignature(credential as any);
}
