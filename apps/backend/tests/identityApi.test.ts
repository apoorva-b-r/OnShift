import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/index';
import { IdentityVerification } from '../src/models/IdentityVerification';
import { generateWorkerToken } from '../src/middleware/authMiddleware';
import { SetuDigiLockerService } from '../src/services/setuDigiLockerService';
import { ApiError } from '../src/middleware/apiError';

describe('DigiLocker Identity REST API Integration Tests (Phase 3)', () => {
  let mongoServer: MongoMemoryServer;
  const workerAToken = generateWorkerToken('OS-WORKER-A');
  const workerBToken = generateWorkerToken('OS-WORKER-B');

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
    jest.restoreAllMocks();
  });

  // =========================================================================
  // 1. Initiate Endpoint Tests
  // =========================================================================
  describe('POST /api/v1/identity/digilocker/initiate', () => {
    it('1. rejects unauthenticated requests with 401', async () => {
      const res = await request(app).post('/api/v1/identity/digilocker/initiate').send({});
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    it('2. successfully creates Setu request session and persists Mongo record for authenticated worker', async () => {
      jest.spyOn(SetuDigiLockerService, 'createRequest').mockResolvedValueOnce({
        id: 'req_setu_init_100',
        status: 'unauthenticated',
        url: 'https://dg-sandbox.setu.co/digilocker/login/req_setu_init_100',
        validUpto: '2026-12-31T23:59:59Z',
      });

      const res = await request(app)
        .post('/api/v1/identity/digilocker/initiate')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        requestId: 'req_setu_init_100',
        authorizationUrl: 'https://dg-sandbox.setu.co/digilocker/login/req_setu_init_100',
        status: 'REQUEST_CREATED',
        validUpto: '2026-12-31T23:59:59Z',
      });

      // Verify MongoDB document
      const mongoRecord = await IdentityVerification.findOne({ workerId: 'OS-WORKER-A' });
      expect(mongoRecord).not.toBeNull();
      expect(mongoRecord?.requestId).toBe('req_setu_init_100');
      expect(mongoRecord?.status).toBe('REQUEST_CREATED');

      // Verify no secrets exposed in response
      const resStr = JSON.stringify(res.body);
      expect(resStr).not.toContain('client-secret');
      expect(resStr).not.toContain('x-client');
    });

    it('3. rejects or ignores body workerId spoofing attempt', async () => {
      jest.spyOn(SetuDigiLockerService, 'createRequest').mockResolvedValueOnce({
        id: 'req_setu_spoof',
        status: 'unauthenticated',
        url: 'https://dg-sandbox.setu.co/digilocker/login/req_setu_spoof',
        validUpto: '2026-12-31T23:59:59Z',
      });

      // Worker A token sending workerId: OS-WORKER-B in body -> rejected by auth middleware
      const res = await request(app)
        .post('/api/v1/identity/digilocker/initiate')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({ workerId: 'OS-WORKER-B' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('WORKER_ID_MISMATCH');

      // Verify OS-WORKER-B record was NOT created in DB
      const recordB = await IdentityVerification.findOne({ workerId: 'OS-WORKER-B' });
      expect(recordB).toBeNull();
    });
  });

  // =========================================================================
  // 2. Status Endpoint Tests
  // =========================================================================
  describe('GET /api/v1/identity/digilocker/status', () => {
    it('4. returns NOT_STARTED and identityVerified: false for worker with no record', async () => {
      const res = await request(app)
        .get('/api/v1/identity/digilocker/status')
        .set('Authorization', `Bearer ${workerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: 'NOT_STARTED',
        identityVerified: false,
        provider: 'SETU_DIGILOCKER',
      });
    });

    it('5. fetches status from Setu and updates Mongo record state to AUTHENTICATED', async () => {
      // Setup existing request
      await IdentityVerification.create({
        workerId: 'OS-WORKER-A',
        provider: 'SETU_DIGILOCKER',
        requestId: 'req_setu_status_200',
        status: 'REQUEST_CREATED',
      });

      jest.spyOn(SetuDigiLockerService, 'getStatus').mockResolvedValueOnce({
        id: 'req_setu_status_200',
        status: 'authenticated',
        url: 'https://dg-sandbox.setu.co/auth',
        validUpto: '2026-12-31T23:59:59Z',
        digilockerUserDetails: { digilockerId: 'dl_123' },
      });

      const res = await request(app)
        .get('/api/v1/identity/digilocker/status')
        .set('Authorization', `Bearer ${workerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('AUTHENTICATED');
      expect(res.body.identityVerified).toBe(false); // Authentication alone does NOT set VERIFIED

      // Check DB updated
      const updatedRecord = await IdentityVerification.findOne({ workerId: 'OS-WORKER-A' });
      expect(updatedRecord?.status).toBe('AUTHENTICATED');
    });

    it('6. prevents cross-worker request querying (Worker B gets NOT_STARTED when querying Worker A state)', async () => {
      await IdentityVerification.create({
        workerId: 'OS-WORKER-A',
        provider: 'SETU_DIGILOCKER',
        requestId: 'req_setu_private',
        status: 'AUTHENTICATED',
      });

      // Worker B requests status
      const res = await request(app)
        .get('/api/v1/identity/digilocker/status')
        .set('Authorization', `Bearer ${workerBToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('NOT_STARTED'); // Worker B has no identity record
      expect(res.body.identityVerified).toBe(false);
    });
  });

  // =========================================================================
  // 3. Verify Endpoint Tests
  // =========================================================================
  describe('POST /api/v1/identity/digilocker/verify', () => {
    it('7. rejects verification before session authentication with 400', async () => {
      await IdentityVerification.create({
        workerId: 'OS-WORKER-A',
        provider: 'SETU_DIGILOCKER',
        requestId: 'req_setu_unauth',
        status: 'REQUEST_CREATED',
      });

      jest.spyOn(SetuDigiLockerService, 'getStatus').mockResolvedValueOnce({
        id: 'req_setu_unauth',
        status: 'unauthenticated',
        url: '',
        validUpto: '',
      });

      const res = await request(app)
        .post('/api/v1/identity/digilocker/verify')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('IDENTITY_NOT_AUTHENTICATED');
    });

    it('8. completes successful Aadhaar verification, updates status to VERIFIED and sets verifiedAt', async () => {
      await IdentityVerification.create({
        workerId: 'OS-WORKER-A',
        provider: 'SETU_DIGILOCKER',
        requestId: 'req_setu_valid',
        status: 'AUTHENTICATED',
      });

      jest.spyOn(SetuDigiLockerService, 'getStatus').mockResolvedValueOnce({
        id: 'req_setu_valid',
        status: 'authenticated',
        url: '',
        validUpto: '',
      });

      jest.spyOn(SetuDigiLockerService, 'getAadhaar').mockResolvedValueOnce({
        id: 'req_setu_valid',
        status: 'complete',
        aadhaar: {
          maskedNumber: 'XXXX-XXXX-9876',
          name: 'Verified Worker',
          dateOfBirth: '1990-01-01',
          gender: 'F',
          verified: { signature: true },
        },
      });

      const res = await request(app)
        .post('/api/v1/identity/digilocker/verify')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: 'VERIFIED',
        identityVerified: true,
        provider: 'SETU_DIGILOCKER',
        verifiedAt: expect.any(String),
      });

      // Verify raw Aadhaar number / PII is NOT returned to client
      expect(res.body.aadhaar).toBeUndefined();
      expect(res.body.maskedNumber).toBeUndefined();

      // Verify DB record status
      const updatedRecord = await IdentityVerification.findOne({ workerId: 'OS-WORKER-A' });
      expect(updatedRecord?.status).toBe('VERIFIED');
      expect(updatedRecord?.verifiedAt).toBeDefined();
    });

    it('9. sets status to FAILED when Aadhaar payload validation fails', async () => {
      await IdentityVerification.create({
        workerId: 'OS-WORKER-A',
        provider: 'SETU_DIGILOCKER',
        requestId: 'req_setu_invalid_aadhaar',
        status: 'AUTHENTICATED',
      });

      jest.spyOn(SetuDigiLockerService, 'getStatus').mockResolvedValueOnce({
        id: 'req_setu_invalid_aadhaar',
        status: 'authenticated',
        url: '',
        validUpto: '',
      });

      jest.spyOn(SetuDigiLockerService, 'getAadhaar').mockResolvedValueOnce({
        id: 'req_setu_invalid_aadhaar',
        status: 'complete',
        aadhaar: undefined, // Missing Aadhaar payload
      });

      const res = await request(app)
        .post('/api/v1/identity/digilocker/verify')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('IDENTITY_VERIFICATION_FAILED');

      const failedRecord = await IdentityVerification.findOne({ workerId: 'OS-WORKER-A' });
      expect(failedRecord?.status).toBe('FAILED');
    });

    it('10. handles Setu upstream 5xx errors by returning sanitized errors', async () => {
      await IdentityVerification.create({
        workerId: 'OS-WORKER-A',
        provider: 'SETU_DIGILOCKER',
        requestId: 'req_setu_500',
        status: 'AUTHENTICATED',
      });

      jest.spyOn(SetuDigiLockerService, 'getStatus').mockRejectedValueOnce(
        new ApiError(502, 'SETU_DIGILOCKER_NETWORK_ERROR', 'Setu DigiLocker gateway unavailable.')
      );

      const res = await request(app)
        .post('/api/v1/identity/digilocker/verify')
        .set('Authorization', `Bearer ${workerAToken}`)
        .send({});

      expect(res.status).toBe(502);
      expect(res.body.error).toBe('SETU_DIGILOCKER_NETWORK_ERROR');
      expect(res.body.message).toBe('Setu DigiLocker gateway unavailable.');
      expect(JSON.stringify(res.body)).not.toContain('client-secret');
    });
  });
});
