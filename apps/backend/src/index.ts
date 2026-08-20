import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import routes from './routes';
import { config } from './config';

const app = express();

app.use(cors());
app.use(express.json());

// API Namespace
app.use('/api/v1', routes);

// Root Fallback
app.get('/', (_req, res) => {
  res.json({
    name: 'OnShift API Gateway (MongoDB)',
    documentation: '/docs/api-contract.md',
    health: '/api/v1/health',
  });
});

if (process.env.NODE_ENV !== 'test') {
  mongoose
    .connect(config.mongodbUri)
    .then(() => console.log(`[OnShift Backend] Connected to MongoDB at ${config.mongodbUri}`))
    .catch((err) => console.warn(`[OnShift Backend] MongoDB connection warning: ${err.message}. Operating in mock/fallback mode.`));

  app.listen(config.port, () => {
    console.log(`[OnShift Backend] Express server running on port ${config.port}`);
  });
}

export default app;
