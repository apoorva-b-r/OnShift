/**
 * loginPersistenceAudit.test.ts
 *
 * Automated test verifying that POST /api/v1/auth/login persists the Worker
 * document in MongoDB when a worker logs in.
 */

import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/index';
import { Worker } from '../src/models';

const DUMMY_WORKER_ID = 'OS-LOGIN-MONGO-PERSIST-001';

describe('Login MongoDB Worker Persistence', () => {
  beforeAll(async () => {
    process.env.ENABLE_AUTH = 'true';
    process.env.NODE_ENV = 'development';
    process.env.JWT_SECRET = 'audit-test-jwt-secret-key-2026-dev-only';

    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/onshift';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await Worker.deleteOne({ id: DUMMY_WORKER_ID });
      await mongoose.disconnect();
    }
  });

  it('stores a new Worker document with full profile in MongoDB upon login (Test 1)', async () => {
    await Worker.deleteOne({ id: DUMMY_WORKER_ID });
    const workerBefore = await Worker.findOne({ id: DUMMY_WORKER_ID });
    expect(workerBefore).toBeNull();

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        workerId: DUMMY_WORKER_ID,
        role: 'WORKER',
        name: 'Physical Test Worker',
        phoneNumber: '+919876543210',
        email: 'testworker@example.com',
        dateOfBirth: '1995-08-15',
        gender: 'Male',
        state: 'Maharashtra',
        city: 'Mumbai',
        workerCategory: 'Delivery Partner',
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeDefined();
    expect(loginRes.body.workerId).toBe(DUMMY_WORKER_ID);

    const workerAfter = await Worker.findOne({ id: DUMMY_WORKER_ID }).lean();
    expect(workerAfter).not.toBeNull();
    expect(workerAfter!.id).toBe(DUMMY_WORKER_ID);
    expect(workerAfter!.name).toBe('Physical Test Worker');
    expect(workerAfter!.phoneNumber).toBe('+919876543210');
    expect(workerAfter!.email).toBe('testworker@example.com');
    expect(workerAfter!.dateOfBirth).toBe('1995-08-15');
    expect(workerAfter!.gender).toBe('Male');
    expect(workerAfter!.state).toBe('Maharashtra');
    expect(workerAfter!.city).toBe('Mumbai');
    expect(workerAfter!.workerCategory).toBe('Delivery Partner');
  });

  it('verifies duplicate logins do not create duplicate Worker documents (Test 2)', async () => {
    const loginRes2 = await request(app)
      .post('/api/v1/auth/login')
      .send({
        workerId: DUMMY_WORKER_ID,
        role: 'WORKER',
        name: 'Physical Test Worker',
        phoneNumber: '+919876543210',
        email: 'testworker@example.com',
        dateOfBirth: '1995-08-15',
        gender: 'Male',
        state: 'Maharashtra',
        city: 'Mumbai',
        workerCategory: 'Delivery Partner',
      });

    expect(loginRes2.status).toBe(200);
    const workerCount = await Worker.countDocuments({ id: DUMMY_WORKER_ID });
    expect(workerCount).toBe(1);
  });

  it('updates existing Worker document fields when intentionally changed (Test 3)', async () => {
    const loginRes3 = await request(app)
      .post('/api/v1/auth/login')
      .send({
        workerId: DUMMY_WORKER_ID,
        role: 'WORKER',
        city: 'Pune',
      });

    expect(loginRes3.status).toBe(200);
    const workerUpdated = await Worker.findOne({ id: DUMMY_WORKER_ID }).lean();
    expect(workerUpdated!.city).toBe('Pune');
    expect(workerUpdated!.state).toBe('Maharashtra'); // Unchanged fields remain intact
    const workerCount = await Worker.countDocuments({ id: DUMMY_WORKER_ID });
    expect(workerCount).toBe(1);
  });

  it('protects existing valid MongoDB profile fields from empty/null login requests (Test 4)', async () => {
    const loginRes4 = await request(app)
      .post('/api/v1/auth/login')
      .send({
        workerId: DUMMY_WORKER_ID,
        role: 'WORKER',
        name: '',
        city: '   ',
      });

    expect(loginRes4.status).toBe(200);
    const workerProtected = await Worker.findOne({ id: DUMMY_WORKER_ID }).lean();
    expect(workerProtected!.city).toBe('Pune'); // Non-empty value preserved
    expect(workerProtected!.name).toBe('Physical Test Worker'); // Non-empty name preserved
  });

  it('verifies sensitive fields are NOT stored in the Worker document (Test 5)', async () => {
    const workerDoc: any = await Worker.findOne({ id: DUMMY_WORKER_ID }).lean();
    expect(workerDoc.password).toBeUndefined();
    expect(workerDoc.passwordHash).toBeUndefined();
    expect(workerDoc.otp).toBeUndefined();
    expect(workerDoc.aadhaar).toBeUndefined();
    expect(workerDoc.rawXml).toBeUndefined();
    expect(workerDoc.digiLockerToken).toBeUndefined();
  });
});
