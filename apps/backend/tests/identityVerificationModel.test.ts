import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  IdentityVerification,
  IDENTITY_VERIFICATION_STATUSES,
} from '../src/models/IdentityVerification';

describe('IdentityVerification Mongoose Model Unit Tests', () => {
  let mongoServer: MongoMemoryServer;

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

  it('1. successfully creates an IdentityVerification document with defaults', async () => {
    const doc = await IdentityVerification.create({
      workerId: 'OS-WORKER-001',
    });

    expect(doc._id).toBeDefined();
    expect(doc.workerId).toBe('OS-WORKER-001');
    expect(doc.provider).toBe('SETU_DIGILOCKER');
    expect(doc.status).toBe('NOT_STARTED');
    expect(doc.createdAt).toBeInstanceOf(Date);
    expect(doc.updatedAt).toBeInstanceOf(Date);
  });

  it('2. fails validation when required workerId is missing', async () => {
    let err: any;
    try {
      await IdentityVerification.create({
        status: 'REQUEST_CREATED',
      } as any);
    } catch (error) {
      err = error;
    }

    expect(err).toBeDefined();
    expect(err.name).toBe('ValidationError');
    expect(err.errors.workerId).toBeDefined();
  });

  it('3. enforces worker ownership via workerId association and indexing', async () => {
    const workerAId = 'OS-WORKER-A';
    const workerBId = 'OS-WORKER-B';

    await IdentityVerification.create({
      workerId: workerAId,
      requestId: 'req-setu-1001',
      status: 'REQUEST_CREATED',
    });

    await IdentityVerification.create({
      workerId: workerBId,
      requestId: 'req-setu-1002',
      status: 'VERIFIED',
      verifiedAt: new Date(),
    });

    const recordsA = await IdentityVerification.find({ workerId: workerAId });
    expect(recordsA).toHaveLength(1);
    expect(recordsA[0].workerId).toBe(workerAId);
    expect(recordsA[0].requestId).toBe('req-setu-1001');

    const recordsB = await IdentityVerification.find({ workerId: workerBId });
    expect(recordsB).toHaveLength(1);
    expect(recordsB[0].workerId).toBe(workerBId);
    expect(recordsB[0].status).toBe('VERIFIED');
  });

  it('4. accepts all valid status values in status enum', async () => {
    for (const status of IDENTITY_VERIFICATION_STATUSES) {
      const record = await IdentityVerification.create({
        workerId: `OS-WORKER-STATUS-${status}`,
        status,
      });
      expect(record.status).toBe(status);
    }
  });

  it('5. rejects invalid status enum values', async () => {
    let err: any;
    try {
      await IdentityVerification.create({
        workerId: 'OS-WORKER-BAD-STATUS',
        status: 'INVALID_STATUS' as any,
      });
    } catch (error) {
      err = error;
    }

    expect(err).toBeDefined();
    expect(err.name).toBe('ValidationError');
    expect(err.errors.status).toBeDefined();
  });

  it('6. generates timestamps (createdAt, updatedAt) and updates validUpto / verifiedAt', async () => {
    const validUptoDate = new Date(Date.now() + 86400000);
    const verifiedDate = new Date();

    const record = await IdentityVerification.create({
      workerId: 'OS-WORKER-TIME',
      requestId: 'req-setu-2001',
      status: 'VERIFIED',
      validUpto: validUptoDate,
      verifiedAt: verifiedDate,
    });

    expect(record.createdAt).toBeInstanceOf(Date);
    expect(record.updatedAt).toBeInstanceOf(Date);
    expect(record.validUpto?.getTime()).toBe(validUptoDate.getTime());
    expect(record.verifiedAt?.getTime()).toBe(verifiedDate.getTime());
  });
});
