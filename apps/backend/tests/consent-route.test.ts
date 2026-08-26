import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/index';
import { generateWorkerToken } from '../src/middleware/authMiddleware';
import { resetAccountAggregatorProviderForTests } from '../src/services/aa/getAccountAggregatorProvider';

describe('Account Aggregator consent route', () => {
  let mongoServer: MongoMemoryServer;
  const workerId = 'OS-AA-ROUTE-TEST';
  let token: string;

  jest.setTimeout(30000);

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    resetAccountAggregatorProviderForTests();
    token = generateWorkerToken(workerId);
    if (mongoose.connection.db) {
      await mongoose.connection.db.dropDatabase();
    }
  });

  it('returns an explicit isMock boolean from the active provider', async () => {
    const response = await request(app)
      .post('/api/v1/consent/request')
      .set('Authorization', `Bearer ${token}`)
      .send({ workerId, fiTypes: ['DEPOSIT'] });

    expect(response.status).toBe(201);
    expect(typeof response.body.isMock).toBe('boolean');
    expect(response.body.consentId).toBeDefined();
    expect(response.body.status).toBeDefined();
  });

  it('fetches consent status via GET /consent/status/:consentId', async () => {
    const initResponse = await request(app)
      .post('/api/v1/consent/request')
      .set('Authorization', `Bearer ${token}`)
      .send({ workerId, fiTypes: ['DEPOSIT'] });

    const consentId = initResponse.body.consentId;

    const response = await request(app)
      .get(`/api/v1/consent/status/${consentId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.consentId).toBe(consentId);
    expect(response.body.workerId).toBe(workerId);
  });
});
