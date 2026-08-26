import { Request, Response } from 'express';
import { DEMO_WORKER } from '@onshift/mock-data';
import mongoose from 'mongoose';
import { Worker } from '../models/Worker';
import { ApiError } from '../middleware/apiError';

const memoryWorkerIds = new Set<string>();

function workerResponse(worker: {
  id: string;
  name?: string;
  workerCategory?: string;
  location?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}) {
  return {
    id: worker.id,
    name: worker.name,
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
  if (id !== authWorkerId) {
    throw new ApiError(403, 'WORKER_ID_MISMATCH', `Authenticated identity (${authWorkerId}) does not match requested worker ID (${id}).`);
  }

  if (mongoose.connection.readyState === 1) {
    const worker = await Worker.findOne({ id: authWorkerId }).lean();
    if (worker) {
      return res.json(workerResponse(worker));
    }
  }

  if (authWorkerId === DEMO_WORKER.id || authWorkerId === 'demo') {
    return res.json(DEMO_WORKER);
  }
  return res.json({
    id: authWorkerId,
    name: 'Gig Delivery Partner',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
};

export const createWorker = async (req: Request, res: Response) => {
  const authWorkerId = req.user?.workerId;
  if (!authWorkerId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authenticated worker identity required.');
  }

  const { id, name, workerCategory, location } = req.body;
  if (id && id !== authWorkerId) {
    throw new ApiError(403, 'WORKER_ID_MISMATCH', `Authenticated identity (${authWorkerId}) does not match body worker ID (${id}).`);
  }

  const workerId = authWorkerId;

  if (mongoose.connection.readyState === 1) {
    try {
      const worker = await Worker.create({
        id: workerId,
        name: name || 'Anonymous Worker',
        workerCategory,
        location,
      });
      return res.status(201).json(workerResponse(worker));
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ApiError(409, 'CONFLICT', 'Worker already exists.');
      }
      throw error;
    }
  }

  if (memoryWorkerIds.has(workerId)) {
    throw new ApiError(409, 'CONFLICT', 'Worker already exists.');
  }
  memoryWorkerIds.add(workerId);

  const worker = {
    id: workerId,
    name: name || 'Anonymous Worker',
    workerCategory,
    location,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return res.status(201).json(worker);
};
