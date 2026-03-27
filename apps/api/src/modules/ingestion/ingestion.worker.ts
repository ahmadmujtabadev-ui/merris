import { createWorker } from '../../lib/queue.js';
import { logger } from '../../lib/logger.js';
import { processDocument } from './ingestion.service.js';

// ============================================================
// Document Processing Worker
// ============================================================

interface ProcessDocumentJob {
  documentId: string;
}

const QUEUE_NAME = 'document-processing';

export function startIngestionWorker() {
  const worker = createWorker<ProcessDocumentJob>(
    QUEUE_NAME,
    async (job) => {
      const { documentId } = job.data;
      logger.info(`Processing document ${documentId} (Job ${job.id})`);

      await processDocument(documentId);
    }
  );

  if (worker) {
    logger.info('Ingestion worker started');

    worker.on('completed', (job) => {
      logger.info(`Document processing completed: Job ${job.id}`);
    });

    worker.on('failed', (job, err) => {
      logger.error(`Document processing failed: Job ${job?.id}`, err);
    });
  } else {
    logger.warn(
      'Redis not available — ingestion worker not started. Documents will need to be processed synchronously.'
    );
  }

  return worker;
}

/**
 * Process a document synchronously (for dev/test without Redis).
 */
export async function processDocumentSync(documentId: string): Promise<void> {
  logger.info(`Processing document ${documentId} synchronously`);
  await processDocument(documentId);
}
