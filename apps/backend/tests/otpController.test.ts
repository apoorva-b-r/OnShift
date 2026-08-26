import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import express from 'express';
import cors from 'cors';
import routes from '../src/routes';
import { errorHandler, notFoundHandler } from '../src/middleware/apiError';
import { PhoneVerification } from '../src/models/PhoneVerification';
import { generateWorkerToken } from '../src/middleware/authMiddleware';
import { hashString } from '../src/services/mockOtpService';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/v1', routes);
app.use(notFoundHandler);
app.use(errorHandler);

describe('Mock OTP Authentication & Verification API Tests (Step 3)', () => {
  let mongoServer: MongoMemoryServer;
  const workerAToken = generateWorkerToken('OS-WORKER-OTP-A');
  const workerBToken = generateWorkerToken('OS-WORKER-OTP-B');

  jest.setTimeout(30000);

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
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

  // =========================================================================
  // 1. POST /api/v1/auth/otp/send Tests
  // =========================================================================
  describe('POST /api/v1/auth/otp/send', () => {
    it('1. rejects unauthenticated request with HTTP 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/otp/send')
        .send({ phoneNumber: '+919876543210' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    it('2. allows authenticated worker to send OTP and returns mock demo hint', async () => {
      const res = await request(app)
        .post('/api/v1/auth/otp/send')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ phoneNumber: '+919876543210' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('OTP_SENT');
      expect(res.body.validForSeconds).toBe(300);
      expect(res.body.demoHint).toContain('123456');

      const record = await PhoneVerification.findOne({ workerId: 'OS-WORKER-OTP-A' });
      expect(record).not.toBeNull();
      expect(record?.status).toBe('PENDING');
      expect(record?.phoneHash).toBe(hashString('+919876543210'));
    });

    it('3. rejects mismatched workerId in body with HTTP 403', async () => {
      const res = await request(app)
        .post('/api/v1/auth/otp/send')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ phoneNumber: '+919876543210', workerId: 'OS-WORKER-OTP-B' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('WORKER_ID_MISMATCH');
    });
  });

  // =========================================================================
  // 2. POST /api/v1/auth/otp/verify Tests
  // =========================================================================
  describe('POST /api/v1/auth/otp/verify', () => {
    it('4. rejects unauthenticated verify request with HTTP 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/otp/verify')
        .send({ phoneNumber: '+919876543210', otp: '123456' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    it('5. succeeds with correct demo OTP (123456) and updates MongoDB status to VERIFIED', async () => {
      // Send OTP first
      await request(app)
        .post('/api/v1/auth/otp/send')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ phoneNumber: '+919876543210' });

      // Verify OTP
      const res = await request(app)
        .post('/api/v1/auth/otp/verify')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ phoneNumber: '+919876543210', otp: '123456' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('VERIFIED');
      expect(res.body.phoneVerified).toBe(true);
      expect(res.body.phoneHash).toBe(hashString('+919876543210'));

      const record = await PhoneVerification.findOne({ workerId: 'OS-WORKER-OTP-A' });
      expect(record?.status).toBe('VERIFIED');
      expect(record?.verifiedAt).toBeDefined();
    });

    it('6. rejects incorrect OTP code with HTTP 400', async () => {
      await request(app)
        .post('/api/v1/auth/otp/send')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ phoneNumber: '+919876543210' });

      const res = await request(app)
        .post('/api/v1/auth/otp/verify')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ phoneNumber: '+919876543210', otp: '000000' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_OTP');
    });

    it('7. verifies worker verification status is tied strictly to req.user.workerId from JWT', async () => {
      // Worker A sends and verifies OTP
      await request(app)
        .post('/api/v1/auth/otp/send')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ phoneNumber: '+919876543210' });

      await request(app)
        .post('/api/v1/auth/otp/verify')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ phoneNumber: '+919876543210', otp: '123456' });

      // Worker B calls verify -> rejected with NO_PENDING_OTP because Worker B has no record
      const resB = await request(app)
        .post('/api/v1/auth/otp/verify')
        .set('Authorization', `Bearer ${workerBToken}`)
        .send({ phoneNumber: '+919876543210', otp: '123456' });

      expect(resB.status).toBe(400);
      expect(resB.body.error).toBe('NO_PENDING_OTP');

      // Worker A remains verified in MongoDB
      const recordA = await PhoneVerification.findOne({ workerId: 'OS-WORKER-OTP-A' });
      expect(recordA?.status).toBe('VERIFIED');

      // Worker B record is unaffected
      const recordB = await PhoneVerification.findOne({ workerId: 'OS-WORKER-OTP-B' });
      expect(recordB).toBeNull();
    });

    it('8. ensures verified status persists across subsequent calls / login sessions', async () => {
      // Step 1: Worker A sends and verifies OTP
      await request(app)
        .post('/api/v1/auth/otp/send')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ phoneNumber: '+919876543210' });

      await request(app)
        .post('/api/v1/auth/otp/verify')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ phoneNumber: '+919876543210', otp: '123456' });

      // Step 2: Worker A logs in tomorrow (new JWT token issued for OS-WORKER-OTP-A)
      const newToken = generateWorkerToken('OS-WORKER-OTP-A');

      // Worker A calls sendOtp again -> returns ALREADY_VERIFIED
      const sendRes = await request(app)
        .post('/api/v1/auth/otp/send')
        .set('Authorization', `Bearer ${newToken}`)
        .send({ phoneNumber: '+919876543210' });

      expect(sendRes.status).toBe(200);
      expect(sendRes.body.status).toBe('ALREADY_VERIFIED');

      // Worker A calls verifyOtp again -> returns VERIFIED
      const verifyRes = await request(app)
        .post('/api/v1/auth/otp/verify')
        .set('Authorization', `Bearer ${newToken}`)
        .send({ phoneNumber: '+919876543210', otp: '123456' });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.status).toBe('VERIFIED');
    });

    it('9. ensures plaintext OTP and plaintext phone number are never stored in MongoDB', async () => {
      await request(app)
        .post('/api/v1/auth/otp/send')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ phoneNumber: '+91 99887 76655' });

      const record = await PhoneVerification.findOne({ workerId: 'OS-WORKER-OTP-A' }).lean();
      const recordStr = JSON.stringify(record);

      expect(recordStr).not.toContain('123456');
      expect(recordStr).not.toContain('9988776655');
      expect(recordStr).not.toContain('+919988776655');
    });
  });
});
