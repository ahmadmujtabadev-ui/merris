import type { IncomingMessage, ServerResponse } from 'http';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

export const config = {
  runtime: 'nodejs',
  maxDuration: 60,
};

let appCache: FastifyInstance | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    if (!appCache) {
      appCache = await buildApp();
    }
    appCache.server.emit('request', req, res);
  } catch (err) {
    console.error('[merris-api] Failed to handle request', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Server initialisation failed' }));
    }
  }
}
