import { generateKeyPairSync, createPrivateKey, createPublicKey, sign as cryptoSign, verify as cryptoVerify } from 'node:crypto';
import { CredentialClaim, VerificationLevel } from '@onshift/shared-types';

export { CredentialClaim, VerificationLevel };

export interface KeyPairHex {
  publicKeyHex: string;
  privateKeyHex: string;
}

export interface OnShiftIncomeCredential {
  type: 'OnShiftIncomeCredential';
  workerId: string;
  issuer: string;
  issuedAt: string;
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
  issuerVerified?: boolean;
  message?: string;
}

export interface SelectiveDisclosureOptions {
  includeVerifiedIncome: boolean;
  includePeriod: boolean;
  includeVerificationLevel: boolean;
}

/**
 * Generate standard Ed25519 keypair in hex encoding.
 */
export function generateEd25519KeyPair(): KeyPairHex {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    publicKeyHex: publicKey.export({ type: 'spki', format: 'der' }).toString('hex'),
    privateKeyHex: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('hex'),
  };
}

/**
 * Helper to parse private key from hex string (PKCS#8 DER or 32-byte seed).
 */
export function privateKeyFromHex(privateKeyHex: string) {
  if (!privateKeyHex || typeof privateKeyHex !== 'string') {
    throw new Error('Private key must be a non-empty hex string.');
  }
  const cleanHex = privateKeyHex.trim();
  if (!/^[0-9a-fA-F]+$/.test(cleanHex)) {
    throw new Error('Private key must be a valid hex string.');
  }

  const keyBuffer = Buffer.from(cleanHex, 'hex');
  if (keyBuffer.length === 32) {
    const pkcs8Header = Buffer.from('302e020100300506032b657004220420', 'hex');
    return createPrivateKey({ key: Buffer.concat([pkcs8Header, keyBuffer]), format: 'der', type: 'pkcs8' });
  }
  return createPrivateKey({ key: keyBuffer, format: 'der', type: 'pkcs8' });
}

/**
 * Helper to parse public key from hex string (SPKI DER or 32-byte key).
 */
export function publicKeyFromHex(publicKeyHex: string) {
  if (!publicKeyHex || typeof publicKeyHex !== 'string') {
    throw new Error('Public key must be a non-empty hex string.');
  }
  const cleanHex = publicKeyHex.trim();
  if (!/^[0-9a-fA-F]+$/.test(cleanHex)) {
    throw new Error('Public key must be a valid hex string.');
  }

  const keyBuffer = Buffer.from(cleanHex, 'hex');
  if (keyBuffer.length === 32) {
    const spkiHeader = Buffer.from('302a300506032b6570032100', 'hex');
    return createPublicKey({ key: Buffer.concat([spkiHeader, keyBuffer]), format: 'der', type: 'spki' });
  }
  return createPublicKey({ key: keyBuffer, format: 'der', type: 'spki' });
}

/**
 * Serialize credential content deterministically for signature generation and verification.
 */
export function serializeCredentialPayload(
  type: string,
  workerId: string,
  issuer: string,
  issuedAt: string,
  claims: CredentialClaim
): string {
  const sortedClaims: Record<string, any> = {};
  const claimKeys = Object.keys(claims).sort();
  for (const key of claimKeys) {
    const val = (claims as Record<string, any>)[key];
    if (val !== undefined) {
      sortedClaims[key] = val;
    }
  }

  return JSON.stringify({
    type,
    workerId,
    issuer,
    issuedAt,
    claims: sortedClaims,
  });
}

/**
 * Sign credential claims using Ed25519 private key.
 */
export function signCredential(
  workerId: string,
  claims: CredentialClaim,
  privateKeyHex: string,
  publicKeyHex: string,
  issuer: string
): OnShiftIncomeCredential {
  if (!workerId || typeof workerId !== 'string' || workerId.trim() === '') {
    throw new Error('Worker ID must be a non-empty string.');
  }

  if (!issuer || typeof issuer !== 'string' || issuer.trim() === '') {
    throw new Error('Issuer must be a non-empty string.');
  }

  if (!claims || typeof claims !== 'object') {
    throw new Error('Claims must be a valid object.');
  }

  if (claims.verifiedIncome !== undefined && (typeof claims.verifiedIncome !== 'number' || Number.isNaN(claims.verifiedIncome))) {
    throw new Error('verifiedIncome must be a valid number.');
  }

  const privateKeyObj = privateKeyFromHex(privateKeyHex);
  const type = 'OnShiftIncomeCredential';
  const issuedAt = new Date().toISOString();

  const payloadString = serializeCredentialPayload(type, workerId, issuer, issuedAt, claims);
  const signatureBuffer = cryptoSign(null, Buffer.from(payloadString, 'utf8'), privateKeyObj);
  const signatureHex = signatureBuffer.toString('hex');

  return {
    type,
    workerId,
    issuer,
    issuedAt,
    claims,
    signature: signatureHex,
    publicKeyHex,
  };
}

/**
 * Verify Ed25519 signature of an OnShift Credential.
 */
export function verifyCredentialSignature(
  credential: OnShiftIncomeCredential
): CredentialVerificationResult {
  if (
    !credential ||
    typeof credential !== 'object' ||
    !credential.signature ||
    typeof credential.signature !== 'string' ||
    !credential.publicKeyHex ||
    typeof credential.publicKeyHex !== 'string' ||
    !credential.type ||
    !credential.workerId ||
    !credential.issuer ||
    !credential.issuedAt ||
    !credential.claims ||
    typeof credential.claims !== 'object'
  ) {
    return {
      valid: false,
      signatureVerified: false,
      message: 'Invalid credential payload structure.',
    };
  }

  try {
    const publicKeyObj = publicKeyFromHex(credential.publicKeyHex);

    const cleanSignatureHex = credential.signature.trim();
    if (!/^[0-9a-fA-F]+$/.test(cleanSignatureHex)) {
      return {
        valid: false,
        signatureVerified: false,
        message: 'Signature must be a valid hex string.',
      };
    }
    const signatureBuffer = Buffer.from(cleanSignatureHex, 'hex');

    const payloadString = serializeCredentialPayload(
      credential.type,
      credential.workerId,
      credential.issuer,
      credential.issuedAt,
      credential.claims
    );

    const isValid = cryptoVerify(
      null,
      Buffer.from(payloadString, 'utf8'),
      publicKeyObj,
      signatureBuffer
    );

    if (isValid) {
      return {
        valid: true,
        signatureVerified: true,
        claims: credential.claims,
        issuer: credential.issuer,
        workerId: credential.workerId,
        issuerVerified: true,
        message: 'Credential signature is authentic and verified.',
      };
    } else {
      return {
        valid: false,
        signatureVerified: false,
        message: 'Credential signature verification failed.',
      };
    }
  } catch (error) {
    return {
      valid: false,
      signatureVerified: false,
      message: `Verification error: ${(error as Error).message}`,
    };
  }
}

/**
 * Filter claims based on worker disclosure selections and sign ONLY the disclosed claims.
 */
export function buildSelectiveDisclosureCredential(
  workerId: string,
  fullClaims: CredentialClaim,
  disclosure: SelectiveDisclosureOptions,
  privateKeyHex: string,
  publicKeyHex: string,
  issuer: string
): OnShiftIncomeCredential {
  const filteredClaims: Partial<CredentialClaim> = {};

  if (disclosure?.includeVerifiedIncome && fullClaims?.verifiedIncome !== undefined) {
    filteredClaims.verifiedIncome = fullClaims.verifiedIncome;
  }

  if (disclosure?.includePeriod && fullClaims?.period !== undefined) {
    filteredClaims.period = fullClaims.period;
  }

  if (disclosure?.includeVerificationLevel && fullClaims?.verificationLevel !== undefined) {
    filteredClaims.verificationLevel = fullClaims.verificationLevel;
  }

  return signCredential(
    workerId,
    filteredClaims as CredentialClaim,
    privateKeyHex,
    publicKeyHex,
    issuer
  );
}
