import { Request, Response } from 'express';
import { getOtpService } from '../services/otpService';
import { ApiError } from '../middleware/apiError';

/**
 * POST /api/v1/auth/otp/send
 * Initiate mock OTP request for the authenticated worker.
 * Worker identity is strictly derived from req.user.workerId (JWT token).
 */
export const sendOtpHandler = async (req: Request, res: Response) => {
  const workerId = req.user?.workerId;
  if (!workerId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authenticated worker identity required.');
  }

  const { phoneNumber } = req.body || {};
  if (!phoneNumber || typeof phoneNumber !== 'string' || !phoneNumber.trim()) {
    throw new ApiError(400, 'INVALID_PHONE_NUMBER', 'Valid phoneNumber string is required in request body.');
  }

  const otpService = getOtpService();
  const result = await otpService.sendOtp(workerId, phoneNumber);
  return res.status(200).json(result);
};

/**
 * POST /api/v1/auth/otp/verify
 * Verify mock OTP code for the authenticated worker.
 * Worker identity is strictly derived from req.user.workerId (JWT token).
 */
export const verifyOtpHandler = async (req: Request, res: Response) => {
  const workerId = req.user?.workerId;
  if (!workerId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authenticated worker identity required.');
  }

  const { phoneNumber, otp } = req.body || {};
  if (!phoneNumber || typeof phoneNumber !== 'string' || !phoneNumber.trim()) {
    throw new ApiError(400, 'INVALID_PHONE_NUMBER', 'Valid phoneNumber string is required in request body.');
  }

  if (!otp || typeof otp !== 'string' || !otp.trim()) {
    throw new ApiError(400, 'INVALID_OTP', 'Valid otp string is required in request body.');
  }

  const otpService = getOtpService();
  const result = await otpService.verifyOtp(workerId, phoneNumber, otp);
  return res.status(200).json({
    ...result,
    phoneVerified: true,
  });
};
