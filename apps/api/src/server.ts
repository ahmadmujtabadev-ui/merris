import { buildApp, FEATURES } from './app.js';
import { logger } from './lib/logger.js';

async function start(): Promise<void> {
  const app = await buildApp();
  const port = parseInt(process.env['PORT'] || '8000', 10);

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
