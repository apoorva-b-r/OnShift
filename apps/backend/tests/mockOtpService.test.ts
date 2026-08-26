import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { PhoneVerification } from '../src/models/PhoneVerification';
import { MockOtpService, hashString } from '../src/services/mockOtpService';
import { ApiError } from '../src/middleware/apiError';

describe('MockOtpService Unit Tests', () => {
  let mongoServer: MongoMemoryServer;
  let otpService: MockOtpService;

  jest.setTimeout(30000);

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    otpService = new MockOtpService();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    if (mongoose.connection.db) {
      await mongoose.connection.db.dropDatabase();
    }
  });

  it('1. sendOtp creates a PENDING PhoneVerification record with hashed values', async () => {
    const workerId = 'OS-WORKER-OTP-1';
    const phoneNumber = '+919876543210';

    const sendRes = await otpService.sendOtp(workerId, phoneNumber);

    expect(sendRes.status).toBe('OTP_SENT');
    expect(sendRes.validForSeconds).toBe(300);
    expect(sendRes.demoHint).toContain('123456');

    const record = await PhoneVerification.findOne({ workerId });
    expect(record).not.toBeNull();
    expect(record?.status).toBe('PENDING');
    expect(record?.attempts).toBe(0);
    expect(record?.expiresAt).toBeDefined();

    // Security invariant: Plaintext OTP is NEVER stored
    expect(record?.otpHash).toBeDefined();
    expect(record?.otpHash).not.toBe('123456');
    expect(record?.otpHash).toBe(hashString('123456'));

    // Security invariant: Plaintext phone number is NEVER stored
    expect(record?.phoneHash).toBe(hashString('+919876543210'));
    expect((record as any).phoneNumber).toBeUndefined();
  });

  it('2. verifyOtp succeeds with correct demo OTP (123456) and sets VERIFIED status', async () => {
    const workerId = 'OS-WORKER-OTP-2';
    const phoneNumber = '+919876543210';

    await otpService.sendOtp(workerId, phoneNumber);

    const verifyRes = await otpService.verifyOtp(workerId, phoneNumber, '123456');

    expect(verifyRes.status).toBe('VERIFIED');
    expect(verifyRes.phoneHash).toBe(hashString('+919876543210'));

    const record = await PhoneVerification.findOne({ workerId });
    expect(record?.status).toBe('VERIFIED');
    expect(record?.verifiedAt).toBeInstanceOf(Date);
    expect(record?.otpHash).toBeUndefined();
    expect(record?.expiresAt).toBeUndefined();
  });

  it('3. verifyOtp increments attempts on incorrect OTP code', async () => {
    const workerId = 'OS-WORKER-OTP-3';
    const phoneNumber = '+919876543210';

    await otpService.sendOtp(workerId, phoneNumber);

    let err: ApiError | undefined;
    try {
      await otpService.verifyOtp(workerId, phoneNumber, '000000');
    } catch (e: any) {
      err = e;
    }

    expect(err).toBeInstanceOf(ApiError);
    expect(err?.statusCode).toBe(400);
    expect(err?.code).toBe('INVALID_OTP');
    expect(err?.message).toContain('2 attempt(s) remaining');

    const record = await PhoneVerification.findOne({ workerId });
    expect(record?.status).toBe('PENDING');
    expect(record?.attempts).toBe(1);
  });

  it('4. third incorrect attempt transitions status to FAILED and blocks further attempts', async () => {
    const workerId = 'OS-WORKER-OTP-4';
    const phoneNumber = '+919876543210';

    await otpService.sendOtp(workerId, phoneNumber);

    // Fail 1
    try { await otpService.verifyOtp(workerId, phoneNumber, '000000'); } catch (_) {}
    // Fail 2
    try { await otpService.verifyOtp(workerId, phoneNumber, '000000'); } catch (_) {}

    let err: ApiError | undefined;
    try {
      // Fail 3
      await otpService.verifyOtp(workerId, phoneNumber, '000000');
    } catch (e: any) {
      err = e;
    }

    expect(err).toBeInstanceOf(ApiError);
    expect(err?.code).toBe('OTP_MAX_ATTEMPTS');

    const record = await PhoneVerification.findOne({ workerId });
    expect(record?.status).toBe('FAILED');
    expect(record?.attempts).toBe(3);

    // Attempting correct OTP after FAILED status should still be rejected
    let retryErr: ApiError | undefined;
    try {
      await otpService.verifyOtp(workerId, phoneNumber, '123456');
    } catch (e: any) {
      retryErr = e;
    }
    expect(retryErr?.code).toBe('OTP_MAX_ATTEMPTS');
  });

  it('5. expired OTP cannot be verified and transitions status to EXPIRED', async () => {
    const workerId = 'OS-WORKER-OTP-5';
    const phoneNumber = '+919876543210';

    await otpService.sendOtp(workerId, phoneNumber);

    // Manually set expiresAt in the past
    await PhoneVerification.updateOne(
      { workerId },
      { $set: { expiresAt: new Date(Date.now() - 1000) } }
    );

    let err: ApiError | undefined;
    try {
      await otpService.verifyOtp(workerId, phoneNumber, '123456');
    } catch (e: any) {
      err = e;
    }

    expect(err).toBeInstanceOf(ApiError);
    expect(err?.code).toBe('OTP_EXPIRED');

    const record = await PhoneVerification.findOne({ workerId });
    expect(record?.status).toBe('EXPIRED');
  });

  it('6. verified status persists across subsequent calls and sendOtp returns ALREADY_VERIFIED', async () => {
    const workerId = 'OS-WORKER-OTP-6';
    const phoneNumber = '+919876543210';

    await otpService.sendOtp(workerId, phoneNumber);
    await otpService.verifyOtp(workerId, phoneNumber, '123456');

    // Call sendOtp again for already verified worker
    const sendAgain = await otpService.sendOtp(workerId, phoneNumber);
    expect(sendAgain.status).toBe('ALREADY_VERIFIED');

    // Call verifyOtp again for already verified worker
    const verifyAgain = await otpService.verifyOtp(workerId, phoneNumber, '123456');
    expect(verifyAgain.status).toBe('VERIFIED');
  });

  it('7. ensures plaintext OTP and plaintext phone number are never stored in MongoDB', async () => {
    const workerId = 'OS-WORKER-OTP-7';
    const phoneNumber = '+91 99988 77766';

    await otpService.sendOtp(workerId, phoneNumber);

    const doc = await PhoneVerification.findOne({ workerId }).lean();
    const docString = JSON.stringify(doc);

    expect(docString).not.toContain('123456');
    expect(docString).not.toContain('9998877766');
    expect(docString).not.toContain('+919998877766');
  });
});
