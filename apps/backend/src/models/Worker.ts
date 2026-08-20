import { Schema, model, Document } from 'mongoose';

export interface IWorkerDocument extends Document {
  id: string;
  name?: string;
  phoneHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WorkerSchema = new Schema<IWorkerDocument>(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String },
    phoneHash: { type: String },
  },
  { timestamps: true }
);

export const WorkerModel = model<IWorkerDocument>('Worker', WorkerSchema);
