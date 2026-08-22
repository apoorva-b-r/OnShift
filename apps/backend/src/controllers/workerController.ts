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
  const { id } = req.params;

  if (mongoose.connection.readyState === 1) {
    const worker = await Worker.findOne({ id }).lean();
    if (worker) {
      return res.json(workerResponse(worker));
    }
  }

  if (id === DEMO_WORKER.id || id === 'demo') {
    return res.json(DEMO_WORKER);
  }
  return res.json({
    id,
    name: 'Gig Delivery Partner',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
};

export const createWorker = async (req: Request, res: Response) => {
  const { id, name, workerCategory, location } = req.body;
  const workerId = id || `OS-WORKER-${Date.now().toString(36).toUpperCase()}`;

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
