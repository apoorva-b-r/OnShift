import { Request, Response } from 'express';
import { DEMO_WORKER } from '@onshift/mock-data';

export const getWorker = async (req: Request, res: Response) => {
  const { id } = req.params;
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
  const { id, name } = req.body;
  const worker = {
    id: id || `OS-WORKER-${Date.now().toString(36).toUpperCase()}`,
    name: name || 'Anonymous Worker',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return res.status(201).json(worker);
};
