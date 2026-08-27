import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/index';
import { Worker } from '../src/models';

describe('Live MongoDB Login Persistence Verification', () => {
  it('performs login and outputs the actual stored MongoDB document', async () => {
    process.env.ENABLE_AUTH = 'true';
    process.env.NODE_ENV = 'development';
    process.env.JWT_SECRET = 'onshift_default_jwt_secret_key_2026_dev_demo_only';

    const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/onshift';
    const TEST_WORKER_ID = 'OS-USER-PROOF-999';

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGO_URI);
    }

    // 1. Clear previous test worker from database
    await Worker.deleteOne({ id: TEST_WORKER_ID });

    // 2. Perform HTTP POST /api/v1/auth/login
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        workerId: TEST_WORKER_ID,
        role: 'WORKER',
        name: 'Rimi Test Worker',
        workerCategory: 'Delivery Partner',
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.workerId).toBe(TEST_WORKER_ID);

    // 3. Query MongoDB directly to inspect stored document
    const storedDoc = await Worker.findOne({ id: TEST_WORKER_ID }).lean();

    console.log('\n================================================================');
    console.log('ACTUAL MONGODB DOCUMENT STORED IN DATABASE [onshift_db.workers]:');
    console.log('================================================================');
    console.log(JSON.stringify(storedDoc, null, 2));
    console.log('================================================================\n');

    expect(storedDoc).not.toBeNull();
    expect(storedDoc!.id).toBe(TEST_WORKER_ID);
    expect(storedDoc!.name).toBe('Rimi Test Worker');
  });
});
