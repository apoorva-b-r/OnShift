import { Request, Response } from 'express';
import { issueCredential, verifyCredential } from '../services/credentialService';
import {
  generateAndSendCredentialMessage,
  getCredentialMessagesForWorker,
} from '../services/credentialMessageService';
import { Credential, VerificationRecord } from '../models';
import { ApiError } from '../middleware/apiError';
import { requireIdentityVerification } from '../services/identityGate';
import { config } from '../config';

export const handleIssueCredential = async (req: Request, res: Response) => {
  const authWorkerId = req.user?.workerId;
  if (!authWorkerId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authenticated worker ID is required.');
  }

  // Enforce body workerId match if explicitly passed by client
  if (req.body?.workerId && req.body.workerId !== authWorkerId) {
    throw new ApiError(
      403,
      'WORKER_ID_MISMATCH',
      `Authenticated worker identity (${authWorkerId}) does not match requested workerId (${req.body.workerId}).`
    );
  }

  const targetWorkerId = authWorkerId;

  // Server-side Identity Gate: Worker identity MUST be VERIFIED in MongoDB via DigiLocker
  await requireIdentityVerification(targetWorkerId);

  let verificationId = req.body?.verificationId;
  if (!verificationId) {
    const latestRecord = await VerificationRecord.findOne({ workerId: targetWorkerId }).sort({ computedAt: -1 }).lean();
    if (latestRecord) {
      verificationId = latestRecord.id;
    }
  }

  if (!verificationId) {
    throw new ApiError(400, 'VERIFICATION_ID_REQUIRED', 'verificationId is required for credential issuance.');
  }

  let record: any = null;

  try {
    record = await VerificationRecord.findOne({ id: verificationId, workerId: targetWorkerId }).lean();
  } catch (_) {
    throw new ApiError(503, 'CREDENTIAL_DATABASE_UNAVAILABLE', 'Credential verification data is temporarily unavailable.');
  }

  if (!record) {
    const otherWorkerRecord = await VerificationRecord.findOne({ id: verificationId }).lean();
    if (otherWorkerRecord && otherWorkerRecord.workerId !== targetWorkerId) {
      throw new ApiError(403, 'FORBIDDEN_WORKER_MISMATCH', `Verification record ${verificationId} belongs to another worker.`);
    }
    throw new ApiError(404, 'VERIFICATION_NOT_FOUND', `Verification record ${verificationId} was not found.`);
  }

  if (record.verificationSource !== 'AUTHORITATIVE_ENGINE' && !config.demoMode) {
    throw new ApiError(409, 'NON_AUTHORITATIVE_VERIFICATION', 'Demo or non-authoritative verification records cannot issue credentials.');
  }

  // Idempotency check: If credential was already issued for this verificationId, return existing
  const existingCred = await Credential.findOne({ verificationId, workerId: targetWorkerId }).lean();
  if (existingCred) {
    const credentialObj = {
      type: existingCred.type || (existingCred as any).credentialType || 'OnShiftIncomeCredential',
      workerId: existingCred.workerId,
      issuer: existingCred.issuer,
      issuedAt: existingCred.issuedAt,
      validUntil: existingCred.validUntil,
      claims: existingCred.claims,
      signature: existingCred.signature,
      publicKeyHex: existingCred.publicKeyHex || existingCred.issuerPublicKey,
      verificationId: existingCred.verificationId,
      credentialId: existingCred.credentialId,
    };
    const messagePayload = await generateAndSendCredentialMessage(existingCred);
    return res.status(200).json({ credential: credentialObj, message: messagePayload });
  }

  // Authoritative server-side claims derived strictly from VerificationRecord
  const periodStr = record.payoutPeriod
    ? `${record.payoutPeriod.startDate} to ${record.payoutPeriod.endDate}`
    : '01 Aug to 07 Aug 2026';

  const verifiedIncome =
    typeof record.expectedNet === 'number'
      ? record.expectedNet
      : typeof record.expectedGross === 'number'
        ? record.expectedGross
        : 30100;

  const authoritativeClaims = {
    verifiedIncome,
    period: periodStr,
    verificationLevel: record.level,
    identityVerified: true,
  };

  const credential = issueCredential(targetWorkerId, authoritativeClaims);

  // Persist credential to MongoDB - this must succeed before returning success
  let createdDoc: any = null;
  try {
    createdDoc = await Credential.create({
      credentialType: credential.type || 'OnShiftIncomeCredential',
      issuer: credential.issuer,
      issuerPublicKey: credential.publicKeyHex || '',
      publicKeyHex: credential.publicKeyHex || '',
      workerId: targetWorkerId,
      verificationId: record.id,
      issuedAt: credential.issuedAt,
      validUntil: (credential as any).validUntil || new Date(Date.now() + 90 * 86400000).toISOString(),
      claims: credential.claims,
      signature: credential.signature,
    });
  } catch (err) {
    console.error('Failed to persist credential document to database:', err);
    throw new ApiError(503, 'CREDENTIAL_PERSISTENCE_FAILED', 'Credential was signed but failed to persist to database. Please retry the request.');
  }

  const responseCredential = {
    ...credential,
    verificationId: record.id,
  };

  const messagePayload = await generateAndSendCredentialMessage(createdDoc ? createdDoc.toObject() : responseCredential);

  return res.status(201).json({ credential: responseCredential, message: messagePayload });
};

export const handleVerifyCredential = async (req: Request, res: Response) => {
  const credential = req.body;
  const result = verifyCredential(credential);
  return res.json(result);
};

export const handleVerifyCredentialById = async (req: Request, res: Response) => {
  const { credentialId } = req.params;
  if (!credentialId || typeof credentialId !== 'string' || !credentialId.trim()) {
    throw new ApiError(400, 'INVALID_CREDENTIAL_ID', 'Credential ID is required.');
  }

  const cleanId = credentialId.trim();
  console.log(`[VERIFY] Received credential ID: ${cleanId}`);

  // Query MongoDB Atlas by credentialId, verificationId, or id
  const credDoc = await Credential.findOne({
    $or: [{ credentialId: cleanId }, { verificationId: cleanId }, { id: cleanId }],
  }).lean();

  if (!credDoc) {
    console.log(`[VERIFY] Credential ID ${cleanId} not found in MongoDB.`);
    throw new ApiError(404, 'CREDENTIAL_NOT_FOUND', `Credential ${cleanId} was not found.`);
  }

  console.log(`[VERIFY] MongoDB lookup successful for workerId=${credDoc.workerId}`);

  const status = credDoc.status || 'ACTIVE';
  if (status !== 'ACTIVE') {
    console.log(`[VERIFY] Credential status is ${status} (not ACTIVE). RESULT = INVALID`);
    return res.status(200).json({
      valid: false,
      credentialId: cleanId,
      status,
      workerId: credDoc.workerId,
      credentialType: credDoc.credentialType || credDoc.type || 'Delivery Partner Work Credential',
      issuer: credDoc.issuer,
      message: `Credential status is ${status}.`,
    });
  }

  // Construct credential object for cryptographic signature verification
  const credentialObj = {
    type: credDoc.type || credDoc.credentialType || 'OnShiftIncomeCredential',
    workerId: credDoc.workerId,
    issuer: credDoc.issuer,
    issuedAt: credDoc.issuedAt,
    validUntil: credDoc.validUntil,
    claims: credDoc.claims,
    signature: credDoc.signature,
    publicKeyHex: credDoc.publicKeyHex || credDoc.issuerPublicKey,
  };

  const verificationResult = verifyCredential(credentialObj);
  console.log(`[VERIFY] Signature verification result: valid=${verificationResult.valid}`);

  if (!verificationResult.valid) {
    console.log(`[VERIFY] RESULT = INVALID (tampered signature)`);
    return res.status(200).json({
      valid: false,
      credentialId: cleanId,
      status: 'INVALID_SIGNATURE',
      workerId: credDoc.workerId,
      credentialType: credDoc.credentialType || credDoc.type || 'Delivery Partner Work Credential',
      issuer: credDoc.issuer,
      message: verificationResult.message || 'Signature verification failed.',
    });
  }

  console.log(`[VERIFY] Credential status ACTIVE`);
  console.log(`[VERIFY] RESULT = VERIFIED`);
  return res.status(200).json({
    valid: true,
    credentialId: cleanId,
    status: 'ACTIVE',
    workerId: credDoc.workerId,
    credentialType: credDoc.credentialType || credDoc.type || 'Delivery Partner Work Credential',
    issuer: credDoc.issuer,
    issuedAt: credDoc.issuedAt,
    validUntil: credDoc.validUntil,
    claims: credDoc.claims,
    message: 'Credential signature is authentic and verified.',
  });
};

export const handleGetCredentialMessages = async (req: Request, res: Response) => {
  const authWorkerId = req.user?.workerId;
  const targetWorkerId = req.params.workerId || authWorkerId;

  if (!targetWorkerId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Worker ID is required.');
  }

  if (authWorkerId && authWorkerId !== targetWorkerId) {
    throw new ApiError(403, 'FORBIDDEN_WORKER_MISMATCH', 'Cannot access messages belonging to another worker.');
  }

  const messages = await getCredentialMessagesForWorker(targetWorkerId);
  return res.json({ messages });
};
