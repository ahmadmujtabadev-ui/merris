import { Queue, Worker, type Processor } from 'bullmq';
import { Redis as IORedis } from 'ioredis';
import { logger } from './logger.js';

const REDIS_URL = process.env['REDIS_URL'];

let connection: IORedis | null = null;

function getConnection(): IORedis | null {
  if (connection) return connection;

  if (!REDIS_URL) {
    logger.warn('REDIS_URL not set — queue system unavailable');
    return null;
  }

  connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
  return connection;
}

export function createQueue(name: string): Queue | null {
  const conn = getConnection();
  if (!conn) return null;

  return new Queue(name, { connection: conn });
}

export function createWorker<T>(
  name: string,
  processor: Processor<T>
): Worker<T> | null {
  const conn = getConnection();
  if (!conn) return null;

  const worker = new Worker<T>(name, processor, { connection: conn });

  worker.on('completed', (job) => {
    logger.info(`Job ${job.id} in queue "${name}" completed`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} in queue "${name}" failed`, err);
  });

  return worker;
}

export { getConnection };
