import { logger } from "../../../lib/logger.js";

type VaultEvent =
  | "upload"
  | "parse"
  | "chunk"
  | "enrich"
  | "embed"
  | "index"
  | "search"
  | "delete"
  | "reprocess"
  | "error";

interface TelemetryPayload {
  event: VaultEvent;
  workspaceId: string;
  documentId?: string;
  filename?: string;
  durationMs?: number;
  chunkCount?: number;
  searchResultCount?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export function emitVaultMetric(payload: TelemetryPayload): void {
  const entry = {
    ...payload,
    timestamp: new Date().toISOString(),
    service: "vault",
  };

  logger.info(JSON.stringify(entry), { vault_event: payload.event });
}

export function withTiming<T>(
  fn: () => Promise<T>,
  event: VaultEvent,
  context: Omit<TelemetryPayload, "event" | "durationMs">
): Promise<T> {
  const start = Date.now();
  return fn()
    .then((result) => {
      emitVaultMetric({ event, ...context, durationMs: Date.now() - start });
      return result;
    })
    .catch((err) => {
      emitVaultMetric({
        event: "error",
        ...context,
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
        metadata: { originalEvent: event },
      });
      throw err;
    });
}
