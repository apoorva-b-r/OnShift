/**
 * Seed script to create a verified identity for testing
 * Run with: npx ts-node seed-identity.ts
 */

import mongoose from 'mongoose';
import { IdentityVerification } from './src/models/IdentityVerification';
import { config } from './src/config';

async function seedIdentity() {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.mongodbUri);
    console.log('Connected to MongoDB');

    // Create or update identity verification for OS-DEMO-001
    const workerId = 'OS-DEMO-001';
    
    const existing = await IdentityVerification.findOne({ workerId });
    
    if (existing) {
      existing.status = 'VERIFIED';
      existing.verifiedAt = new Date();
      existing.provider = 'SETU_DIGILOCKER';
      await existing.save();
      console.log(`Updated identity verification for ${workerId} to VERIFIED`);
    } else {
      await IdentityVerification.create({
        workerId,
        provider: 'SETU_DIGILOCKER',
        requestId: 'test-request-id-123',
        status: 'VERIFIED',
        verifiedAt: new Date(),
      });
      console.log(`Created identity verification for ${workerId} with VERIFIED status`);
    }

    // Verify the update
    const record = await IdentityVerification.findOne({ workerId });
    console.log('Current identity status:', record?.status);
    console.log('Identity verified:', record?.status === 'VERIFIED');

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding identity:', error);
    process.exit(1);
  }
}

seedIdentity();