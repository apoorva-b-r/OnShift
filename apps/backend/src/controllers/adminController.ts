import { Request, Response } from 'express';
import { IdentityVerification } from '../models/IdentityVerification';

/**
 * POST /api/v1/admin/set-identity-verified
 * Admin endpoint to set identity verification status for testing
 * This is for demo/testing purposes only
 */
export const setIdentityVerified = async (req: Request, res: Response) => {
  const { workerId } = req.body;
  
  if (!workerId) {
    return res.status(400).json({ error: 'workerId is required' });
  }

  try {
    const existing = await IdentityVerification.findOne({ workerId });
    
    if (existing) {
      existing.status = 'VERIFIED';
      existing.verifiedAt = new Date();
      existing.provider = 'SETU_DIGILOCKER';
      await existing.save();
      return res.status(200).json({ 
        message: 'Identity verification status updated to VERIFIED',
        workerId,
        status: 'VERIFIED',
        verifiedAt: existing.verifiedAt
      });
    } else {
      const newRecord = await IdentityVerification.create({
        workerId,
        provider: 'SETU_DIGILOCKER',
        requestId: 'test-request-id',
        status: 'VERIFIED',
        verifiedAt: new Date(),
      });
      return res.status(201).json({ 
        message: 'Identity verification record created with VERIFIED status',
        workerId,
        status: 'VERIFIED',
        verifiedAt: newRecord.verifiedAt
      });
    }
  } catch (error) {
    console.error('Error setting identity verified:', error);
    return res.status(500).json({ error: 'Failed to set identity verification status' });
  }
};