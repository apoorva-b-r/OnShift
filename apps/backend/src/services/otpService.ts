export interface SendOtpResult {
  status: 'OTP_SENT' | 'ALREADY_VERIFIED';
  validForSeconds?: number;
  demoHint?: string;
  message?: string;
}

export interface VerifyOtpResult {
  status: 'VERIFIED' | 'FAILED' | 'EXPIRED';
  phoneHash: string;
  message?: string;
}

/**
 * IOtpService
 * Abstraction interface for OTP verification providers.
 * Decouples controller and business logic from specific OTP providers
 * (e.g. MockOtpService for demo vs. Msg91OtpService for production).
 */
export interface IOtpService {
  sendOtp(workerId: string, phoneNumber: string): Promise<SendOtpResult>;
  verifyOtp(workerId: string, phoneNumber: string, otp: string): Promise<VerifyOtpResult>;
}

/**
 * Factory function to retrieve the active IOtpService instance based on configuration.
 * Defaults to MockOtpService when OTP_PROVIDER is 'MOCK' or unset.
 */
export function getOtpService(): IOtpService {
  // Lazy import MockOtpService to prevent circular dependency issues
  const { MockOtpService } = require('./mockOtpService');
  return new MockOtpService();
}
