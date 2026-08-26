import { generateKeyPairSync, createPrivateKey, createPublicKey, sign as cryptoSign, verify as cryptoVerify } from 'crypto';
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
  issuerVerified?: boolean;
  message?: string;
}

export interface TrustedIssuerConfig {
  issuer: string;
  publicKeyHex: string;
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
  validUntil: string,
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
    validUntil,
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
  const issuedAt = new Date();
  const issuedAtISO = issuedAt.toISOString();
  const validUntil = new Date(issuedAt.getTime() + 90 * 24 * 60 * 60 * 1000);
  const validUntilISO = validUntil.toISOString();

  const payloadString = serializeCredentialPayload(type, workerId, issuer, issuedAtISO, validUntilISO, claims);
  const signatureBuffer = cryptoSign(null, Buffer.from(payloadString, 'utf8'), privateKeyObj);
  const signatureHex = signatureBuffer.toString('hex');

  return {
    type,
    workerId,
    issuer,
    issuedAt: issuedAtISO,
    validUntil: validUntilISO,
    claims,
    signature: signatureHex,
    publicKeyHex,
  };
}

/**
 * Verify Ed25519 signature of an OnShift Credential.
 */
export function verifyCredentialSignature(
  credential: OnShiftIncomeCredential | any,
  trustedIssuer?: TrustedIssuerConfig
): CredentialVerificationResult {
  if (!credential || typeof credential !== 'object') {
    return {
      valid: false,
      signatureVerified: false,
      message: 'Invalid credential payload structure.',
    };
  }

  const raw = credential.credential && typeof credential.credential === 'object' ? credential.credential : credential;
  const type = raw.type || raw.credentialType || 'OnShiftIncomeCredential';
  const publicKeyHex = raw.publicKeyHex || raw.issuerPublicKey;
  const workerId = raw.workerId;
  const issuer = raw.issuer;
  const issuedAt = raw.issuedAt;
  const validUntil = raw.validUntil;
  const claims = raw.claims;
  const signature = raw.signature;

  if (
    !signature ||
    typeof signature !== 'string' ||
    !publicKeyHex ||
    typeof publicKeyHex !== 'string' ||
    !type ||
    !workerId ||
    !issuer ||
    !issuedAt ||
    !validUntil ||
    !claims ||
    typeof claims !== 'object'
  ) {
    return {
      valid: false,
      signatureVerified: false,
      message: 'Invalid credential payload structure.',
    };
  }

  if (type !== 'OnShiftIncomeCredential') {
    return {
      valid: false,
      signatureVerified: false,
      issuer,
      workerId,
      issuerVerified: false,
      message: 'Unsupported credential type.',
    };
  }

  if (!trustedIssuer || typeof trustedIssuer.issuer !== 'string' || typeof trustedIssuer.publicKeyHex !== 'string') {
    return {
      valid: false,
      signatureVerified: false,
      issuer,
      workerId,
      issuerVerified: false,
      message: 'No trusted issuer configuration was supplied.',
    };
  }

  if (issuer !== trustedIssuer.issuer) {
    return {
      valid: false,
      signatureVerified: false,
      issuer,
      workerId,
      issuerVerified: false,
      message: 'Credential issuer does not match the trusted OnShift issuer.',
    };
  }

  if (publicKeyHex.trim().toLowerCase() !== trustedIssuer.publicKeyHex.trim().toLowerCase()) {
    return {
      valid: false,
      signatureVerified: false,
      issuer,
      workerId,
      issuerVerified: false,
      message: 'Credential public key does not match the trusted OnShift issuer key.',
    };
  }

  try {
    const publicKeyObj = publicKeyFromHex(trustedIssuer.publicKeyHex);

    let cleanSignatureHex = signature.trim();
    if (cleanSignatureHex.startsWith('0x') || cleanSignatureHex.startsWith('0X')) {
      cleanSignatureHex = cleanSignatureHex.slice(2);
    }
    if (!/^[0-9a-fA-F]+$/.test(cleanSignatureHex)) {
      return {
        valid: false,
        signatureVerified: false,
        message: 'Signature must be a valid hex string.',
      };
    }
    const signatureBuffer = Buffer.from(cleanSignatureHex, 'hex');

    const payloadString = serializeCredentialPayload(
      type,
      workerId,
      issuer,
      issuedAt,
      validUntil,
      claims
    );

    const isValid = cryptoVerify(
      null,
      Buffer.from(payloadString, 'utf8'),
      publicKeyObj,
      signatureBuffer
    );

    if (isValid) {
      // Signature is cryptographically valid. Now enforce the validity window.
      if (validUntil) {
        const expiry = new Date(validUntil);
        if (Number.isNaN(expiry.getTime())) {
          return {
            valid: false,
            signatureVerified: true,
            claims,
            issuer,
            workerId,
            issuerVerified: true,
            message: 'Credential signature is valid, but validUntil is not a valid ISO timestamp.',
          };
        }
        if (expiry.getTime() < Date.now()) {
          return {
            valid: false,
            signatureVerified: true,
            claims,
            issuer,
            workerId,
            issuerVerified: true,
            message: `Credential signature is authentic, but this credential expired on ${expiry.toISOString()}. Code: CREDENTIAL_EXPIRED.`,
          };
        }
      }

      return {
        valid: true,
        signatureVerified: true,
        claims,
        issuer,
        workerId,
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
