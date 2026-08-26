import * as crypto from 'crypto';
import { PhoneVerification } from '../models/PhoneVerification';
import { ApiError } from '../middleware/apiError';
import { IOtpService, SendOtpResult, VerifyOtpResult } from './otpService';

/**
 * Normalize phone number to standard E.164 format.
 * Example: "9876543210" -> "+919876543210", "+91 98765 43210" -> "+919876543210"
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone || typeof phone !== 'string') {
    throw new ApiError(400, 'INVALID_PHONE_NUMBER', 'Valid phone number string is required.');
  }

  const cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned) {
    throw new ApiError(400, 'INVALID_PHONE_NUMBER', 'Phone number must contain numeric digits.');
  }

  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  }
  return `+${cleaned}`;
}

/**
 * Compute SHA-256 hex string for a given input.
 */
export function hashString(input: string): string {
  return crypto.createHash('sha256').update(input.trim()).digest('hex');
}

/**
 * Compare two SHA-256 hex strings in constant time.
 */
function safeTimingEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

/**
 * MockOtpService
 * Implementation of IOtpService using PhoneVerification Mongoose model
 * and deterministic mock OTP ("123456") for local testing and demo mode.
 *
 * SECURITY INVARIANTS:
 * 1. Plaintext OTP is NEVER stored in MongoDB. Only SHA-256 otpHash is persisted.
 * 2. Raw phone numbers are NEVER stored in MongoDB. Only SHA-256 phoneHash is persisted.
 * 3. Plaintext OTP and phone numbers are NEVER logged to stdout or external services.
 * 4. Maximum 3 failed verification attempts before status becomes FAILED.
 * 5. OTP expires after 5 minutes (300 seconds).
 */
export class MockOtpService implements IOtpService {
  private static readonly DEMO_MOCK_OTP = '123456';
  private static readonly OTP_TTL_SECONDS = 300; // 5 minutes
  private static readonly MAX_ATTEMPTS = 3;

  /**
   * Send a demo mock OTP to the given workerId and phone number.
   */
  async sendOtp(workerId: string, phoneNumber: string): Promise<SendOtpResult> {
    if (!workerId || typeof workerId !== 'string' || !workerId.trim()) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Worker identity required for OTP request.');
    }

    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    const phoneHash = hashString(normalizedPhone);

    let record = await PhoneVerification.findOne({ workerId: workerId.trim() });

    // A previously VERIFIED record does not require re-verification
    if (record && record.status === 'VERIFIED') {
      return {
        status: 'ALREADY_VERIFIED',
        message: 'Phone number already verified for this worker.',
      };
    }

    const mockOtpHash = hashString(MockOtpService.DEMO_MOCK_OTP);
    const expiresAt = new Date(Date.now() + MockOtpService.OTP_TTL_SECONDS * 1000);

    if (!record) {
      record = new PhoneVerification({
        workerId: workerId.trim(),
        phoneHash,
        status: 'PENDING',
        otpHash: mockOtpHash,
        attempts: 0,
        expiresAt,
      });
    } else {
      record.phoneHash = phoneHash;
      record.status = 'PENDING';
      record.otpHash = mockOtpHash;
      record.attempts = 0;
      record.expiresAt = expiresAt;
      record.verifiedAt = undefined;
    }

    await record.save();

    return {
      status: 'OTP_SENT',
      validForSeconds: MockOtpService.OTP_TTL_SECONDS,
      demoHint: 'Demo Mode: Use OTP 123456',
    };
  }

  /**
   * Verify an OTP submitted for the given workerId and phone number.
   */
  async verifyOtp(workerId: string, phoneNumber: string, otp: string): Promise<VerifyOtpResult> {
    if (!workerId || typeof workerId !== 'string' || !workerId.trim()) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Worker identity required for OTP verification.');
    }

    if (!otp || typeof otp !== 'string' || !otp.trim()) {
      throw new ApiError(400, 'INVALID_OTP', 'OTP code is required.');
    }

    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    const phoneHash = hashString(normalizedPhone);

    const record = await PhoneVerification.findOne({ workerId: workerId.trim() });

    if (!record || !record.otpHash) {
      if (record && record.status === 'VERIFIED' && record.phoneHash === phoneHash) {
        return { status: 'VERIFIED', phoneHash };
      }
      throw new ApiError(400, 'NO_PENDING_OTP', 'No pending OTP request found for this worker.');
    }

    if (record.phoneHash !== phoneHash) {
      throw new ApiError(400, 'PHONE_MISMATCH', 'Phone number does not match active OTP request.');
    }

    if (record.status === 'VERIFIED') {
      return { status: 'VERIFIED', phoneHash };
    }

    // Check expiration
    if (record.status === 'EXPIRED' || (record.expiresAt && Date.now() > record.expiresAt.getTime())) {
      if (record.status !== 'EXPIRED') {
        record.status = 'EXPIRED';
        await record.save();
      }
      throw new ApiError(400, 'OTP_EXPIRED', 'OTP has expired. Please request a new OTP.');
    }

    // Check max attempts
    if (record.status === 'FAILED' || record.attempts >= MockOtpService.MAX_ATTEMPTS) {
      if (record.status !== 'FAILED') {
        record.status = 'FAILED';
        await record.save();
      }
      throw new ApiError(400, 'OTP_MAX_ATTEMPTS', 'Maximum verification attempts exceeded. Please request a new OTP.');
    }

    const inputHash = hashString(otp);
    const isMatch = safeTimingEqual(inputHash, record.otpHash);

    if (!isMatch) {
      record.attempts += 1;
      if (record.attempts >= MockOtpService.MAX_ATTEMPTS) {
        record.status = 'FAILED';
      }
      await record.save();

      if (record.status === 'FAILED') {
        throw new ApiError(400, 'OTP_MAX_ATTEMPTS', 'Maximum verification attempts exceeded. Please request a new OTP.');
      }
      throw new ApiError(400, 'INVALID_OTP', `Invalid OTP code. ${MockOtpService.MAX_ATTEMPTS - record.attempts} attempt(s) remaining.`);
    }

    // Success! Update status to VERIFIED and clear transient OTP state
    const now = new Date();
    record.status = 'VERIFIED';
    record.verifiedAt = now;
    record.otpHash = undefined;
    record.expiresAt = undefined;
    record.attempts = 0;

    await record.save();

    return {
      status: 'VERIFIED',
      phoneHash,
    };
  }
}
