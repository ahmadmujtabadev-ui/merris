import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import dotenv from 'dotenv';
import { logger } from './lib/logger.js';

dotenv.config();

const FEATURES = {
  sharepoint: false,
  teamsBot: false,
};

const app = Fastify({
  logger: false,
});

async function start() {
  await app.register(cors, {
    origin: process.env['NEXT_PUBLIC_APP_URL'] || 'http://localhost:3000',
    credentials: true,
  });

  await app.register(websocket);

  // Health check
  app.get('/api/v1/health', async (_request, _reply) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      features: FEATURES,
    };
  });

  const port = parseInt(process.env['PORT'] || '3001', 10);

  try {
    await app.listen({ port, host: '0.0.0.0' });
    logger.info(`Merris API running on port ${port}`);
    logger.info(`Feature flags: ${JSON.stringify(FEATURES)}`);
  } catch (err) {
    logger.error('Failed to start server', err);
    process.exit(1);
  }
}

start();

export { app };
