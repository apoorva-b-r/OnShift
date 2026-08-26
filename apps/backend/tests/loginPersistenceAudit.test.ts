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

  it('stores a new Worker document in MongoDB upon login', async () => {
    // 1. Ensure worker document does not exist before login
    await Worker.deleteOne({ id: DUMMY_WORKER_ID });
    const workerBefore = await Worker.findOne({ id: DUMMY_WORKER_ID });
    expect(workerBefore).toBeNull();

    // 2. Perform POST /api/v1/auth/login
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        workerId: DUMMY_WORKER_ID,
        role: 'WORKER',
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.workerId).toBe(DUMMY_WORKER_ID);

    // 3. Verify Worker document NOW exists in MongoDB
    const workerAfter = await Worker.findOne({ id: DUMMY_WORKER_ID }).lean();
    expect(workerAfter).not.toBeNull();
    expect(workerAfter!.id).toBe(DUMMY_WORKER_ID);
    expect(workerAfter!.workerCategory).toBe('Delivery Partner');

    console.log('\n========================================================');
    console.log('=== EXACT MONGODB DOCUMENT STORED IN [workers] COLLECTION ===');
    console.log('========================================================');
    console.log(JSON.stringify(workerAfter, null, 2));
    console.log('========================================================\n');
  });

  it('retrieves existing Worker document on subsequent logins without creating duplicates', async () => {
    const loginRes2 = await request(app)
      .post('/api/v1/auth/login')
      .send({
        workerId: DUMMY_WORKER_ID,
        role: 'WORKER',
      });

    expect(loginRes2.status).toBe(200);
    const workerCount = await Worker.countDocuments({ id: DUMMY_WORKER_ID });
    expect(workerCount).toBe(1);
  });
});
