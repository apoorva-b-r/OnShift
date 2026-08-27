import { Request, Response } from 'express';
import { DEMO_WORKER } from '@onshift/mock-data';
import mongoose from 'mongoose';
import { Worker } from '../models/Worker';
import { ApiError } from '../middleware/apiError';

const memoryWorkerIds = new Set<string>();

function workerResponse(worker: {
  id: string;
  name?: string;
  phoneNumber?: string;
  email?: string;
  dateOfBirth?: string;
  gender?: string;
  state?: string;
  city?: string;
  workerCategory?: string;
  location?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}) {
  return {
    id: worker.id,
    name: worker.name,
    phoneNumber: worker.phoneNumber,
    email: worker.email,
    dateOfBirth: worker.dateOfBirth,
    gender: worker.gender,
    state: worker.state,
    city: worker.city,
    workerCategory: worker.workerCategory,
    location: worker.location,
    createdAt: worker.createdAt ? new Date(worker.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: worker.updatedAt ? new Date(worker.updatedAt).toISOString() : new Date().toISOString(),
  };
}

export const getWorker = async (req: Request, res: Response) => {
  const authWorkerId = req.user?.workerId;
  if (!authWorkerId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authenticated worker identity required.');
  }

  const { id } = req.params;

  if (mongoose.connection.readyState === 1) {
    const searchCriteria: any[] = [
      { id: authWorkerId },
      { id: id }
    ];
    if (authWorkerId.includes('@')) searchCriteria.push({ email: authWorkerId });
    if (id && id.includes('@')) searchCriteria.push({ email: id });

    const worker = await Worker.findOne({ $or: searchCriteria }).lean();
    if (worker) {
      return res.json(workerResponse(worker));
    }
  }

  if (authWorkerId === DEMO_WORKER.id || authWorkerId === 'demo') {
    return res.json(DEMO_WORKER);
  }
  return res.json({
    id: authWorkerId,
    name: 'Sadhana R Somaiya',
    email: authWorkerId.includes('@') ? authWorkerId : 'sadhana.r@somaiya.edu',
    phoneNumber: '+91 98765 43210',
    dateOfBirth: '1998-05-15',
    gender: 'Female',
    state: 'Maharashtra',
    city: 'Mumbai',
    workerCategory: 'Delivery Partner',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
};

export const createWorker = async (req: Request, res: Response) => {
  const authWorkerId = req.user?.workerId;
  if (!authWorkerId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authenticated worker identity required.');
  }

  const { id, name, phoneNumber, email, dateOfBirth, gender, state, city, workerCategory, location } = req.body;
  if (id && id !== authWorkerId) {
    throw new ApiError(403, 'WORKER_ID_MISMATCH', `Authenticated identity (${authWorkerId}) does not match body worker ID (${id}).`);
  }

  const workerId = authWorkerId;

  if (mongoose.connection.readyState === 1) {
    try {
      const worker = await Worker.create({
        id: workerId,
        name: name || 'Anonymous Worker',
        phoneNumber,
        email,
        dateOfBirth,
        gender,
        state,
        city,
        workerCategory,
        location: location || (city && state ? `${city}, ${state}` : location),
      });
      return res.status(201).json(workerResponse(worker));
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        const updated = await Worker.findOneAndUpdate(
          { id: workerId },
          {
            $set: {
              name: name || 'Anonymous Worker',
              ...(phoneNumber && { phoneNumber }),
              ...(email && { email }),
              ...(dateOfBirth && { dateOfBirth }),
              ...(gender && { gender }),
              ...(state && { state }),
              ...(city && { city }),
              ...(workerCategory && { workerCategory }),
              ...(location && { location: location || (city && state ? `${city}, ${state}` : location) }),
            },
          },
          { new: true }
        );
        return res.status(200).json(workerResponse(updated || { id: workerId }));
      }
      throw error;
    }
  }

  if (memoryWorkerIds.has(workerId)) {
    return res.status(200).json({
      id: workerId,
      name: name || 'Anonymous Worker',
      phoneNumber,
      email,
      dateOfBirth,
      gender,
      state,
      city,
      workerCategory,
      location,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  memoryWorkerIds.add(workerId);

  const worker = {
    id: workerId,
    name: name || 'Anonymous Worker',
    phoneNumber,
    email,
    dateOfBirth,
    gender,
    state,
    city,
    workerCategory,
    location,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return res.status(201).json(worker);
};
