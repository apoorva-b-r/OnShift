import type { CredentialClaim, OnShiftIncomeCredential, CredentialVerificationResult } from './credentialTypes';

const SPKI_HEADER = new Uint8Array([
  0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
]);

const TRUSTED_ISSUER = import.meta.env.VITE_ONSHIFT_ISSUER || 'OnShift Proof Authority';
const TRUSTED_ISSUER_PUBLIC_KEY = import.meta.env.VITE_ONSHIFT_ISSUER_PUBLIC_KEY || '';

const CLAIM_LABELS: Record<string, string> = {
  verifiedIncome: 'Verified Income',
  period: 'Payout Period',
  verificationLevel: 'Verification Level',
};

function hexToBytes(hex: string): Uint8Array {
  let clean = hex.trim();
  if (clean.startsWith('0x') || clean.startsWith('0X')) {
    clean = clean.slice(2);
  }
  if (!/^[0-9a-fA-F]+$/.test(clean) || clean.length % 2 !== 0) {
    throw new Error('Invalid hex string.');
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function toSpkiPublicKey(publicKeyHex: string): Uint8Array {
  const keyBytes = hexToBytes(publicKeyHex);
  if (keyBytes.length === 32) {
    const combined = new Uint8Array(SPKI_HEADER.length + 32);
    combined.set(SPKI_HEADER);
    combined.set(keyBytes, SPKI_HEADER.length);
    return combined;
  }
  return keyBytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Must match packages/credential-schema serializeCredentialPayload exactly. */
export function serializeCredentialPayload(
  type: string,
  workerId: string,
  issuer: string,
  issuedAt: string,
  validUntil: string | undefined,
  claims: CredentialClaim
): string {
  const sortedClaims: Record<string, unknown> = {};
  if (claims && typeof claims === 'object') {
    const claimKeys = Object.keys(claims).sort();
    for (const key of claimKeys) {
      const val = (claims as Record<string, unknown>)[key];
      if (val !== undefined) {
        sortedClaims[key] = val;
      }
    }
  }

  const payloadObj: Record<string, unknown> = {
    type,
    workerId,
    issuer,
    issuedAt,
  };
  if (validUntil !== undefined) {
    payloadObj.validUntil = validUntil;
  }
  payloadObj.claims = sortedClaims;

  return JSON.stringify(payloadObj);
}

function extractCredentialObject(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== 'object') return null;
  const obj = input as Record<string, unknown>;
  if (obj.credential && typeof obj.credential === 'object') {
    return extractCredentialObject(obj.credential);
  }
  return obj;
}

export function normalizeCredential(input: unknown): {
  type: string;
  workerId: string;
  issuer: string;
  issuedAt: string;
  validUntil?: string;
  claims: CredentialClaim;
  signature: string;
  publicKeyHex: string;
} | null {
  const target = extractCredentialObject(input);
  if (!target) return null;

  const type = (target.type || target.credentialType || 'OnShiftIncomeCredential') as string;
  const workerId = target.workerId;
  const issuer = target.issuer;
  const issuedAt = target.issuedAt;
  const validUntil = target.validUntil;
  const signature = target.signature;
  const publicKeyHex = target.publicKeyHex || target.issuerPublicKey;
  const claims = target.claims as CredentialClaim;

  if (
    typeof workerId !== 'string' ||
    typeof issuer !== 'string' ||
    typeof issuedAt !== 'string' ||
    typeof signature !== 'string' ||
    typeof publicKeyHex !== 'string' ||
    typeof validUntil !== 'string' ||
    !claims ||
    typeof claims !== 'object'
  ) {
    return null;
  }

  return {
    type,
    workerId,
    issuer,
    issuedAt,
    validUntil,
    claims,
    signature,
    publicKeyHex: publicKeyHex as string,
  };
}

function isOnShiftIncomeCredential(value: unknown): boolean {
  return normalizeCredential(value) !== null;
}

function formatClaimValue(key: string, value: unknown): string {
  if (key === 'verifiedIncome' && typeof value === 'number') {
    return `₹${value.toLocaleString('en-IN')}`;
  }
  return String(value);
}

export function formatClaimLabel(key: string): string {
  return CLAIM_LABELS[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}

export { formatClaimValue };

/**
 * Independently verify any OnShift income credential using Ed25519 (Web Crypto).
 * Trust is anchored to build-time configured issuer metadata, never credential input.
 */
export async function verifyCredentialInBrowser(input: unknown): Promise<CredentialVerificationResult> {
  const credential = normalizeCredential(input);
  if (!credential) {
    return {
      valid: false,
      signatureVerified: false,
      message:
        'Invalid credential format. Expected a signed credential JSON object with workerId, issuer, issuedAt, claims, signature, and publicKeyHex (or issuerPublicKey).',
    };
  }

  if (credential.issuer !== TRUSTED_ISSUER) {
    return {
      valid: false,
      signatureVerified: false,
      issuerVerified: false,
      issuer: credential.issuer,
      workerId: credential.workerId,
      message: 'Credential issuer does not match the trusted OnShift issuer.',
    };
  }

  if (!TRUSTED_ISSUER_PUBLIC_KEY || credential.publicKeyHex.toLowerCase() !== TRUSTED_ISSUER_PUBLIC_KEY.toLowerCase()) {
    return {
      valid: false,
      signatureVerified: false,
      issuerVerified: false,
      issuer: credential.issuer,
      workerId: credential.workerId,
      message: 'Credential public key does not match the trusted OnShift issuer key.',
    };
  }

  try {
    const signatureBytes = hexToBytes(credential.signature);
    const publicKeyDer = toSpkiPublicKey(TRUSTED_ISSUER_PUBLIC_KEY);
    const payloadString = serializeCredentialPayload(
      credential.type,
      credential.workerId,
      credential.issuer,
      credential.issuedAt,
      credential.validUntil,
      credential.claims
    );
    const payloadBytes = new TextEncoder().encode(payloadString);

    const publicKey = await crypto.subtle.importKey(
      'spki',
      toArrayBuffer(publicKeyDer),
      { name: 'Ed25519' },
      false,
      ['verify']
    );

    const signatureValid = await crypto.subtle.verify(
      'Ed25519',
      publicKey,
      toArrayBuffer(signatureBytes),
      payloadBytes
    );

    const baseMeta = {
      claims: credential.claims,
      issuer: credential.issuer,
      workerId: credential.workerId,
      issuedAt: credential.issuedAt,
      validUntil: credential.validUntil,
    };

    if (!signatureValid) {
      return {
        valid: false,
        signatureVerified: false,
        ...baseMeta,
        message:
          'Verification failed: Ed25519 signature does not match the credential payload. The document may have been altered or forged.',
      };
    }

    if (credential.validUntil) {
      const expiry = new Date(credential.validUntil);
      if (Number.isNaN(expiry.getTime())) {
        return {
          valid: false,
          signatureVerified: true,
          ...baseMeta,
          message: 'Credential signature is valid, but validUntil is not a valid ISO timestamp.',
        };
      }

      if (expiry.getTime() < Date.now()) {
        return {
          valid: false,
          signatureVerified: true,
          issuerVerified: true,
          ...baseMeta,
          message: `Credential signature is authentic, but this credential expired on ${expiry.toLocaleDateString('en-IN')}.`,
        };
      }
    }

    return {
      valid: true,
      signatureVerified: true,
      issuerVerified: true,
      ...baseMeta,
      message: 'Credential signature verified. Payload is authentic and has not been tampered with.',
    };
  } catch (error) {
    return {
      valid: false,
      signatureVerified: false,
      issuer: credential?.issuer,
      workerId: credential?.workerId,
      message: `Verification error: ${(error as Error).message}`,
    };
  }
}
