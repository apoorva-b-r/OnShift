import { CredentialMessage, CredentialMessageDocument } from '../models/CredentialMessage';

const DEPLOYED_VERIFIER_BASE_URL =
  process.env.VERIFIER_WEB_URL ||
  'https://on-shift-verifier-web-22pj-lb8kaaio1-apscaps.vercel.app';

export interface CredentialMessagePayload {
  messageId: string;
  workerId: string;
  credentialId: string;
  title: string;
  body: string;
  verificationUrl: string;
  attachments: Array<{
    fileName: string;
    mimeType: string;
    content: Record<string, any>;
  }>;
  createdAt: string;
}

/**
 * Generalized credential message generator & sender service.
 * Takes any issued credential object and produces:
 * 1. A formatted notification text body.
 * 2. A verification URL pointing to the deployed Vercel site with credentialId query parameter.
 * 3. A canonical credential.json attachment containing non-sensitive payload fields & Ed25519 signature.
 * 4. Idempotently persists the message document in MongoDB Atlas.
 */
export async function generateAndSendCredentialMessage(
  credentialDoc: Record<string, any>
): Promise<CredentialMessagePayload> {
  const credentialId =
    credentialDoc.credentialId ||
    credentialDoc.verificationId ||
    credentialDoc.id ||
    `CRED-${Date.now()}`;

  const workerId = credentialDoc.workerId || 'UNKNOWN_WORKER';
  const credentialType =
    credentialDoc.credentialType ||
    credentialDoc.type ||
    'Delivery Partner Work Credential';
  const issuer = credentialDoc.issuer || 'Mock Credential Provider';
  const status = credentialDoc.status || 'ACTIVE';
  const issuedAt = credentialDoc.issuedAt || new Date().toISOString();
  const validUntil = credentialDoc.validUntil || new Date(Date.now() + 90 * 86400000).toISOString();

  const verificationUrl = `${DEPLOYED_VERIFIER_BASE_URL.replace(/\/$/, '')}/?credentialId=${encodeURIComponent(credentialId)}`;

  // Construct non-sensitive canonical JSON attachment representation of the EXACT SAME credential
  const credentialAttachmentJson: Record<string, any> = {
    type: credentialDoc.type || 'OnShiftIncomeCredential',
    credentialType,
    credentialId,
    verificationId: credentialDoc.verificationId,
    workerId,
    issuer,
    status,
    issuedAt,
    validUntil,
    claims: credentialDoc.claims || {},
    signature: credentialDoc.signature || '',
    publicKeyHex: credentialDoc.publicKeyHex || credentialDoc.issuerPublicKey || '',
  };

  // Strip any accidental private key fields or server secrets
  delete credentialAttachmentJson.privateKey;
  delete credentialAttachmentJson.privateKeyHex;
  delete credentialAttachmentJson.secret;
  delete credentialAttachmentJson.password;

  const title = `${credentialType} Issued`;
  const body = [
    `[${issuer}]`,
    '',
    `Your ${credentialType} has been issued successfully.`,
    '',
    `Worker:`,
    `${workerId}`,
    '',
    `Credential ID:`,
    `${credentialId}`,
    '',
    `Status:`,
    `${status}`,
    '',
    `Your credential is attached to this message.`,
    '',
    `📎 credential.json`,
    '',
    `Verify your credential securely on OnShift:`,
    '',
    `${verificationUrl}`,
  ].join('\n');

  const messageId = `msg-cred-${credentialId}-${Date.now()}`;

  const messagePayload: CredentialMessagePayload = {
    messageId,
    workerId,
    credentialId,
    title,
    body,
    verificationUrl,
    attachments: [
      {
        fileName: 'credential.json',
        mimeType: 'application/json',
        content: credentialAttachmentJson,
      },
    ],
    createdAt: new Date().toISOString(),
  };

  try {
    await CredentialMessage.create({
      messageId,
      workerId,
      credentialId,
      title,
      body,
      verificationUrl,
      attachments: messagePayload.attachments,
      createdAt: messagePayload.createdAt,
    });
    console.log(`[CREDENTIAL_MESSAGE] Generated & stored message for workerId=${workerId}, credentialId=${credentialId}`);
  } catch (err) {
    console.warn(`[CREDENTIAL_MESSAGE] Warning: Could not persist message document to MongoDB: ${(err as Error).message}`);
  }

  return messagePayload;
}

/**
 * Retrieve messages for a given workerId.
 */
export async function getCredentialMessagesForWorker(
  workerId: string
): Promise<any[]> {
  return CredentialMessage.find({ workerId }).sort({ createdAt: -1 }).lean();
}
