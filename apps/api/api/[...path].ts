import type { IncomingMessage, ServerResponse } from 'http';
import { buildApp } from '../src/app.js';

export const config = {
  runtime: 'nodejs',
  maxDuration: 60,
};

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const app = await buildApp();
  app.server.emit('request', req, res);
}
