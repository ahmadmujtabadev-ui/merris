import { Queue, Worker } from "bullmq";
import { getConnection } from "../../lib/queue.js";
import { logger } from "../../lib/logger.js";
import { runVaultPipeline, type PipelineInput } from "./vault-pipeline.js";
import { VAULT_QUEUE_NAME } from "./types.js";
import { emitVaultMetric } from "./metrics/vault-telemetry.js";

const DEAD_LETTER_QUEUE = `${VAULT_QUEUE_NAME}-dead-letter`;

export function startVaultWorker(): void {
  const conn = getConnection();
  if (!conn) {
    logger.warn(
      "Vault worker not started — Redis unavailable, pipeline will run synchronously"
    );
    return;
  }

  const worker = new Worker<PipelineInput>(
    VAULT_QUEUE_NAME,
    async (job) => {
      logger.info(
        `Vault worker: processing job ${job.id} — ${job.data.filename} (attempt ${job.attemptsMade + 1})`
      );
      await runVaultPipeline(job.data);
    },
    {
      connection: conn,
      concurrency: 2,
      limiter: { max: 5, duration: 60_000 },
    }
  );

  worker.on("completed", (job) => {
    logger.info(`Vault worker: job ${job.id} completed — ${job.data.filename}`);
  });

  worker.on("failed", (job, err) => {
    if (!job) return;
    const attemptsLeft = (job.opts.attempts || 3) - job.attemptsMade;
    if (attemptsLeft > 0) {
      logger.warn(
        `Vault worker: job ${job.id} failed (${attemptsLeft} retries left) — ${err.message}`
      );
    } else {
      logger.error(
        `Vault worker: job ${job.id} exhausted all retries — moving to dead-letter queue`,
        err
      );
      moveToDeadLetter(conn, job.data, err.message).catch((dlqErr) =>
        logger.error("Failed to move job to dead-letter queue", dlqErr)
      );

      emitVaultMetric({
        event: "error",
        workspaceId: job.data.workspaceId,
        documentId: job.data.documentId,
        filename: job.data.filename,
        error: `Exhausted retries: ${err.message}`,
        metadata: { deadLettered: true },
      });
    }
  });

  logger.info("Vault processing worker started");
}

async function moveToDeadLetter(
  conn: ReturnType<typeof getConnection>,
  data: PipelineInput,
  error: string
): Promise<void> {
  if (!conn) return;
  const dlq = new Queue(DEAD_LETTER_QUEUE, { connection: conn });
  await dlq.add("dead-vault-document", {
    ...data,
    buffer: undefined,
    failedAt: new Date().toISOString(),
    error,
  });
}
