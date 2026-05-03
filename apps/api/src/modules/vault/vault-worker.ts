import { createWorker } from "../../lib/queue.js";
import { logger } from "../../lib/logger.js";
import { runVaultPipeline, type PipelineInput } from "./vault-pipeline.js";
import { VAULT_QUEUE_NAME } from "./types.js";

export function startVaultWorker(): void {
  const worker = createWorker<PipelineInput>(
    VAULT_QUEUE_NAME,
    async (job) => {
      logger.info(
        `Vault worker: processing job ${job.id} — ${job.data.filename}`
      );
      await runVaultPipeline(job.data);
    }
  );

  if (worker) {
    logger.info("Vault processing worker started");
  } else {
    logger.warn(
      "Vault worker not started — Redis unavailable, pipeline will run synchronously"
    );
  }
}
