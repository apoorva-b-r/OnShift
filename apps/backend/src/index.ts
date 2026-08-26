import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
// @ts-ignore
import { WebSocketServer, WebSocket } from 'ws';
import routes from './routes';
import { config } from './config';
import { errorHandler, notFoundHandler } from './middleware/apiError';
import { handleSchemeRecommendWs } from './services/schemeWsService';

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

app.use(notFoundHandler);
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  const connectDb = async () => {
    try {
      await mongoose.connect(config.mongodbUri, { serverSelectionTimeoutMS: 2000 });
      console.log(`[OnShift Backend] Connected to MongoDB at ${config.mongodbUri}`);
    } catch (err: any) {
      console.warn(`[OnShift Backend] Local MongoDB not reachable (${err.message}). Starting in-memory MongoDB...`);
      try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const memoryServer = await MongoMemoryServer.create();
        const memoryUri = memoryServer.getUri();
        await mongoose.connect(memoryUri);
        console.log(`[OnShift Backend] In-memory MongoDB connected at ${memoryUri}`);
      } catch (memErr: any) {
        console.error(`[OnShift Backend] Failed to start in-memory MongoDB:`, memErr);
      }
    }
  };
  connectDb();

  // HTTP REST API (port 4000)
  app.listen(config.port, () => {
    console.log(`[OnShift Backend] Express server running on port ${config.port}`);
  });

  // ─── WebSocket Server for Android Nemotron streaming (port 3000) ──────────
  const wsPort = parseInt(process.env.WS_PORT || '3000', 10);
  const wss = new WebSocketServer({ port: wsPort });

  wss.on('connection', (ws: WebSocket) => {
    console.log('[OnShift WS] Android client connected');

    ws.on('message', async (data: any) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === 'scheme:recommend') {
          await handleSchemeRecommendWs(ws, message.payload || {});
        }
      } catch (_e) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: 'scheme:error',
              payload: { message: 'Invalid message format' },
            })
          );
        }
      }
    });

    ws.on('close', () => {
      console.log('[OnShift WS] Android client disconnected');
    });

    ws.on('error', (err: any) => {
      console.error('[OnShift WS] Error:', err.message);
    });
  });

  wss.on('listening', () => {
    console.log(`[OnShift WS] WebSocket server (Nemotron) running on port ${wsPort}`);
  });
}

export default app;

